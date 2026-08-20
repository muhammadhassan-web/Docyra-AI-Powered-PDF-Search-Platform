import { useState, useRef } from 'react';
import {
    Upload, Trash2, FileText, Briefcase, Cpu,
    CheckCircle, Database, Loader2, ExternalLink,
    AlertCircle, Search, ShieldCheck
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Policy } from '../types';
import EmployeeAccessCard from './EmployeeAccessCard';
import { useTilt3D } from '../hooks/useTilt3D';
import { useHoverLift } from '../hooks/useHoverLift';

interface AdminPanelProps {
    policies: Policy[];
    setPolicies: (policies: Policy[]) => void;
    onRefresh: () => void;
}

interface UploadSignature {
    timestamp: number;
    signature: string;
    cloudName: string;
    apiKey: string;
    folder: string;
    allowedFormats: string;
}

const AdminPanel = ({ policies, onRefresh }: AdminPanelProps) => {
    const [selectedDept, setSelectedDept] = useState<'HR' | 'IT'>('HR');
    const [uploading, setUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropzoneRef = useTilt3D<HTMLDivElement>(6);
    const statCardRef = useHoverLift<HTMLDivElement>();

    const filteredPolicies = policies.filter(policy => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return policy.name.toLowerCase().includes(term) || policy.department.toLowerCase().includes(term);
    });

    const formatFileName = (rawName: string) => {
        return rawName
            .replace(/\.[^/.]+$/, "")
            .replace(/[_-]/g, " ")
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    const showStatus = (text: string, type: 'success' | 'error' | 'info') => {
        setStatusMessage({ text, type });
        setTimeout(() => setStatusMessage(null), 4000);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Security Check: Only PDFs
        if (file.type !== 'application/pdf') {
            showStatus("Only PDF files are supported for vault indexing.", 'error');
            return;
        }

        setUploading(true);
        const cleanName = formatFileName(file.name);
        showStatus(`Processing ${cleanName}...`, 'info');

        try {
            // STEP 1: Get a server-signed Cloudinary signature (never expose the API secret to the browser)
            const sig = await api.get<UploadSignature>('/api/uploads/signature');

            // STEP 2: Upload directly to Cloudinary using the signature
            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', sig.apiKey);
            formData.append('timestamp', String(sig.timestamp));
            formData.append('signature', sig.signature);
            formData.append('folder', sig.folder);
            formData.append('allowed_formats', sig.allowedFormats);

            const cloudinaryRes = await fetch(
                `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
                { method: 'POST', body: formData }
            );

            const cloudinaryData = await cloudinaryRes.json();
            if (!cloudinaryData.secure_url) throw new Error("Cloudinary handshake failed.");

            // STEP 3: MONGODB INDEXING (Server extracts text and scopes to your organization)
            await api.post('/api/policies', {
                name: cleanName,
                department: selectedDept,
                lastUpdated: new Date().toISOString().split('T')[0],
                file_url: cloudinaryData.secure_url,
            });

            showStatus(`Successfully Synced: ${cleanName}`, 'success');
            onRefresh();
        } catch (error) {
            console.error("Upload Error:", error);
            const message = error instanceof ApiError || error instanceof Error ? error.message : "Connection lost during upload.";
            showStatus(message, 'error');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!id) return;
        if (!window.confirm("Confirm deletion? This will remove the intelligence data from the vault.")) return;

        try {
            await api.del(`/api/policies/${id}`);
            showStatus("Asset purged from Vault.", 'success');
            onRefresh();
        } catch (error) {
            const message = error instanceof ApiError || error instanceof Error ? error.message : 'Unknown error';
            showStatus("Purge Failed: " + message, 'error');
        }
    };

    return (
        <div className="flex-1 p-4 md:p-8 bg-[#f8fafc] overflow-y-auto">
            <div className="max-w-5xl mx-auto">
                
                {/* Header Section */}
                <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="text-blue-600" size={20} />
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Intelligence Control</h2>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">
                            Status: <span className="text-green-600 font-bold italic animate-pulse">● Vault Connected</span>
                        </p>
                    </div>
                    
                    <div className="flex gap-3">
                        <div ref={statCardRef} className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 cursor-default">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                <Database size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Vault Status</p>
                                <p className="text-sm font-bold text-slate-700">{policies.length} Assets Indexed</p>
                            </div>
                        </div>
                    </div>
                </div>

                <EmployeeAccessCard />

                {/* Navigation & Messaging */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200">
                        <button 
                            onClick={() => setSelectedDept('HR')} 
                            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${selectedDept === 'HR' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Briefcase size={14} /> HR VAULT
                        </button>
                        <button 
                            onClick={() => setSelectedDept('IT')} 
                            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${selectedDept === 'IT' ? 'bg-white shadow-md text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Cpu size={14} /> IT VAULT
                        </button>
                    </div>

                    {statusMessage && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm border animate-in fade-in slide-in-from-top-2 duration-300 ${
                            statusMessage.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 
                            statusMessage.type === 'info' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-600'
                        }`}>
                            {statusMessage.type === 'success' ? <CheckCircle size={14} /> : statusMessage.type === 'info' ? <Loader2 size={14} className="animate-spin" /> : <AlertCircle size={14} />} 
                            {statusMessage.text}
                        </div>
                    )}
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf" />
                
                {/* Upload Dropzone */}
                <div
                    ref={dropzoneRef}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`relative bg-white p-10 md:p-16 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center mb-10 transition-shadow duration-300 cursor-pointer group shadow-sm hover:shadow-xl ${uploading ? 'opacity-60 cursor-not-allowed' : ''} ${selectedDept === 'HR' ? 'border-blue-200 hover:border-blue-500' : 'border-purple-200 hover:border-purple-500'}`}
                >
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${selectedDept === 'HR' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {uploading ? <Loader2 size={40} className="animate-spin" /> : <Upload size={40} />}
                    </div>
                    <h3 className="font-black text-slate-800 text-xl text-center mb-2">
                        {uploading ? 'Extracting Intelligence...' : `Upload ${selectedDept} Protocol`}
                    </h3>
                    <p className="text-slate-400 text-sm font-medium">Click to browse or drag PDF files here</p>
                    
                    {uploading && (
                        <div className="absolute inset-x-10 bottom-8">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full animate-progress ${selectedDept === 'HR' ? 'bg-blue-500' : 'bg-purple-500'}`} style={{ width: '60%' }}></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Global Asset Registry</h4>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Filter vault..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                aria-label="Filter vault documents"
                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                <tr>
                                    <th className="px-8 py-5">Asset Intelligence</th>
                                    <th className="px-8 py-5">Assigned Vault</th>
                                    <th className="px-8 py-5">Source Link</th>
                                    <th className="px-8 py-5 text-right">Registry Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredPolicies.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center opacity-20">
                                                <Database size={48} className="mb-4" />
                                                <p className="font-bold text-lg">
                                                    {policies.length === 0 ? 'No intelligence assets indexed.' : 'No documents match your filter.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPolicies.map((policy) => (
                                        <tr key={policy._id} className="text-sm group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl ${policy.department === 'IT' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-700 leading-tight">{policy.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Updated {policy.lastUpdated}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight ${policy.department === 'HR' ? 'bg-blue-100/50 text-blue-700' : 'bg-purple-100/50 text-purple-700'}`}>
                                                    {policy.department}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                {policy.file_url ? (
                                                    <a 
                                                        href={policy.file_url.replace('/upload/', '/upload/fl_attachment/')} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="inline-flex items-center gap-1.5 text-blue-600 font-bold text-xs hover:text-blue-800 underline underline-offset-4 decoration-blue-200"
                                                    >
                                                        <ExternalLink size={14} /> RAW DATA
                                                    </a>
                                                ) : <span className="text-slate-300 italic text-xs">Unlinked</span>}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button 
                                                    onClick={() => handleDelete(policy._id)} 
                                                    className="text-slate-300 hover:text-red-500 transition-all p-2.5 hover:bg-red-50 rounded-xl"
                                                    title="Purge Intelligence"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <style>{`
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-progress {
                    animation: progress 2s infinite linear;
                }
            `}</style>
        </div>
    );
};

export default AdminPanel;
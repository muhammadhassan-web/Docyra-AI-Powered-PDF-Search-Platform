import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function orgUploadFolder(organizationId) {
    return `docyra_vault/${organizationId}`;
}

export function buildSignedUploadParams(organizationId) {
    const timestamp = Math.round(Date.now() / 1000);
    // allowed_formats is part of the signed payload, so Cloudinary enforces it
    // server-side — the client can no longer bypass the "PDF only" check by
    // spoofing File.type.
    const paramsToSign = { timestamp, folder: orgUploadFolder(organizationId), allowed_formats: 'pdf' };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    return {
        timestamp,
        signature,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder: paramsToSign.folder,
        allowedFormats: paramsToSign.allowed_formats,
    };
}

import { describe, it, expect, beforeAll } from 'vitest';
import { assertTrustedCloudinaryUrl } from './policies.routes.js';

beforeAll(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'docyra-demo';
});

describe('assertTrustedCloudinaryUrl', () => {
    const orgA = '507f1f77bcf86cd799439011';
    const orgB = '507f1f77bcf86cd799439022';

    it('accepts a URL under the requesting org\'s own Cloudinary folder', () => {
        expect(() => assertTrustedCloudinaryUrl(
            `https://res.cloudinary.com/docyra-demo/image/upload/v1/docyra_vault/${orgA}/policy.pdf`,
            orgA
        )).not.toThrow();
    });

    it('rejects a URL that lives under a different org\'s folder (tenant isolation)', () => {
        expect(() => assertTrustedCloudinaryUrl(
            `https://res.cloudinary.com/docyra-demo/image/upload/v1/docyra_vault/${orgB}/policy.pdf`,
            orgA
        )).toThrow();
    });

    it('rejects a URL with no folder scoping at all', () => {
        expect(() => assertTrustedCloudinaryUrl(
            'https://res.cloudinary.com/docyra-demo/image/upload/v1/docyra_vault/policy.pdf',
            orgA
        )).toThrow();
    });

    it('rejects URLs pointing at a different Cloudinary account', () => {
        expect(() => assertTrustedCloudinaryUrl(
            `https://res.cloudinary.com/someone-else/image/upload/v1/docyra_vault/${orgA}/x.pdf`,
            orgA
        )).toThrow();
    });

    it('rejects non-Cloudinary hosts (SSRF guard)', () => {
        expect(() => assertTrustedCloudinaryUrl('http://169.254.169.254/latest/meta-data/', orgA)).toThrow();
    });

    it('rejects plain http (non-https) URLs', () => {
        expect(() => assertTrustedCloudinaryUrl(
            `http://res.cloudinary.com/docyra-demo/image/upload/v1/docyra_vault/${orgA}/policy.pdf`,
            orgA
        )).toThrow();
    });

    it('rejects malformed URLs', () => {
        expect(() => assertTrustedCloudinaryUrl('not-a-url', orgA)).toThrow();
    });
});

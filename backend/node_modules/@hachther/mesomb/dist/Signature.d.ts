export declare class Signature {
    static signRequest(service: string, method: string, url: string, date: Date, nonce: string, credentials: {
        secretKey: string;
        accessKey: string;
    }, headers?: Record<string, string>, body?: Record<string, any>): string;
}

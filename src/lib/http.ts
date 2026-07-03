export class HttpException extends Error {
    public readonly statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.name = 'HttpException';
        this.statusCode = statusCode;
    }
}

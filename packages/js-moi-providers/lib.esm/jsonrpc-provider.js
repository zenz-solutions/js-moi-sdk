import fetch from "cross-fetch";
import { CustomError, ErrorCode, ErrorUtils } from "js-moi-utils";
import { BaseProvider } from "./base-provider";
/**
 * A class that represents a JSON-RPC provider for making RPC calls over HTTP.
 */
export class JsonRpcProvider extends BaseProvider {
    host;
    constructor(host) {
        super();
        if (/^http(s)?:\/\//i.test(host) || /^ws(s)?:\/\//i.test(host)) {
            this.host = host;
            return;
        }
        ErrorUtils.throwError("Invalid request url!", ErrorCode.INVALID_ARGUMENT);
    }
    /**
     * Executes an RPC call by sending a method and parameters.
     *
     * @param method - The method to call.
     * @param params - The parameters for the method call.
     * @returns A Promise that resolves to the result of the RPC call.
     * @throws Error if there is an error executing the RPC call.
     */
    async execute(method, params) {
        try {
            return await this.send(method, [params]);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Sends an RPC request to the JSON-RPC endpoint.
     *
     * @param method - The method to call.
     * @param params - The parameters for the method call.
     * @returns A Promise that resolves to the result of the RPC call.
     * @throws Error if there is an error sending the RPC request.
     */
    async send(method, params) {
        try {
            const payload = {
                method: method,
                params: params,
                jsonrpc: "2.0",
                id: 1
            };
            const response = await fetch(this.host, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                const errMessage = await response.text();
                if (this.isServerError(response)) {
                    ErrorUtils.throwError(`Error: ${errMessage}`, ErrorCode.SERVER_ERROR);
                }
                throw new Error(errMessage);
            }
            return await response.json();
        }
        catch (error) {
            if (error instanceof CustomError) {
                throw error;
            }
            ErrorUtils.throwError(`Error: ${error.message}`, ErrorCode.NETWORK_ERROR);
        }
    }
}
//# sourceMappingURL=jsonrpc-provider.js.map
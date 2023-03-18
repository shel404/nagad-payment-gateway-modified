type IClientType = 'PC_WEB' | 'MOBILE_WEB' | 'MOBILE_APP' | 'WALLET_WEB_VIEW' | 'BILL_KEY';

/**
 * Configuration Required by the NagadGateway Library
 */
interface INagadConstructor {
    /**
     * ### Nagad API BaseURL
     * @example
     * ```
     * const baseURL = 'http://sandbox.mynagad.com/remote-payment-gateway'; //no trailing slash
     * ```
     *
     */
    baseURL: string;
    merchantID: string;
    merchantNumber: string;
    /**
     * ### Path to merchant private Key `The keys that you will generate`
     * @example
     * ```
     * const privKeyPath = '.keys/privKey.pem';
     * ```
     *
     */
    privKey: string;
    /**
     * ### Path to nagad's public key `It's Provided by nagad`
     * @example
     * ```
     * const privKeyPath = '.keys/pubKey.pem';
     * ```
     *
     */
    pubKey: string;
    /**
     * @example
     * ```
     * const myCallBackURL = 'https://yoursite.com/payment_redirect_handler';
     * ```
     */
    callbackURL: string;
    apiVersion: string;
    isPath: boolean;
}
/**
 * ### Nagad Payment Creation Argument lists
 * ### Required Properties:
 * - orderID `string`
 * - amount `string`
 * - productDetails `object`
 * - ip `string`
 * - clientType `enum`
 */
interface ICreatePaymentArgs {
    /**
     * `Merchant Order ID`
     */
    orderId: string;
    /**
     * `Amount in String` **BDT**
     */
    amount: string;
    /**
     * ### Additional Details for product
     * `Accepts an object`
     */
    productDetails: Record<string, string>;
    /**
     * **Client IP ADDRESS**
     */
    ip: string;
    /**
     * ### Client Type
     * **Possible Values**:
     * - `'PC_WEB'`
     * - `'MOBILE_WEB'`
     * - `'MOBILE_APP'`
     * - `'WALLET_WEB_VIEW'`
     * - `'BILL_KEY'`
     */
    clientType: IClientType;
}

interface INagadPaymentVerificationResponse {
    merchantId: string;
    orderId: string;
    paymentRefId: string;
    amount: string;
    clientMobileNo: string | null;
    merchantMobileNo: string;
    orderDateTime: string | null;
    issuerPaymentDateTime: string;
    issuerPaymentRefNo: string;
    additionalMerchantInfo: string | null;
    status: string;
    statusCode: string;
}

declare class NagadGateway {
    private readonly baseURL;
    private readonly merchantID;
    private readonly merchantNumber;
    private readonly pubKey;
    private readonly privKey;
    private readonly headers;
    private readonly callbackURL;
    constructor(config: INagadConstructor);
    /**
     * ## Initiate a Payment from nagad
     *
     * @param createPaymentConfig Arguments for payment creation
     * @example
     * ```javascript
     * const paymentConfig: ICreatePaymentArgs = {
     *   amount: '100',
     *   ip: '10.10.0.10',
     *   orderId: '12111243GD',
     *   productDetails: { a: '1', b: '2' },
     *   clientType: 'PC_WEB',
     * };
     * const paymentURL = await nagad .createPayment(paymentConfig);
     * ```
     * @returns `Payment URL for nagad`
     *
     */
    createPayment(createPaymentConfig: ICreatePaymentArgs): Promise<string>;
    verifyPayment(paymentRefID: string): Promise<INagadPaymentVerificationResponse>;
    private confirmPayment;
    private encrypt;
    private decrypt;
    private sign;
    private getTimeStamp;
    private createHash;
    private genKeys;
    private formatKey;
}

export { NagadGateway, NagadGateway as default };

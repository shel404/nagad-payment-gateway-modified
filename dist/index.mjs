// src/index.ts
import * as crypto from "crypto";
import * as fs from "fs";

// src/utils/request.ts
import fetch from "node-fetch";

// src/exceptions/NagadException.ts
var NagadException = class extends Error {
  constructor(message, reason) {
    super(reason);
    this.reason = reason;
    this.name = "NagadException";
    this.stack = this.stack ?? new Error().stack;
  }
};

// src/utils/request.ts
async function get(url, additionalHeaders) {
  const r = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "application/json",
      Accept: "application/json",
      ...additionalHeaders
    }
  });
  const data = await r.json();
  if (data.devMessage) {
    throw new NagadException(data.devMessage, data.reason);
  }
  if (data.reason) {
    throw new NagadException(data.message, data.reason);
  }
  return data;
}
async function post(url, payload = {}, additionalHeaders) {
  const r = await fetch(url, {
    headers: {
      "content-type": "application/json",
      Accept: "application/json",
      ...additionalHeaders
    },
    body: JSON.stringify(payload),
    method: "POST"
  });
  const data = await r.json();
  if (data.devMessage) {
    throw new NagadException(data.devMessage, data.reason);
  }
  if (data.reason) {
    throw new NagadException(data.message, data.reason);
  }
  return data;
}

// src/index.ts
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
var NagadGateway = class {
  constructor(config) {
    const {
      baseURL,
      callbackURL,
      merchantID,
      merchantNumber,
      privKey,
      pubKey,
      apiVersion,
      isPath
    } = config;
    this.baseURL = baseURL;
    this.merchantID = merchantID;
    this.merchantNumber = merchantNumber;
    this.headers = {
      "X-KM-Api-Version": apiVersion
    };
    this.callbackURL = callbackURL;
    const { privateKey, publicKey } = this.genKeys(privKey, pubKey, isPath);
    this.privKey = privateKey;
    this.pubKey = publicKey;
    dayjs.extend(utc);
    dayjs.extend(timezone);
  }
  async createPayment(createPaymentConfig) {
    const { amount, ip, orderId, productDetails, clientType } = createPaymentConfig;
    const endpoint = `${this.baseURL}/api/dfs/check-out/initialize/${this.merchantID}/${orderId}`;
    const timestamp = this.getTimeStamp();
    const sensitive = {
      merchantId: this.merchantID,
      datetime: timestamp,
      orderId,
      challenge: this.createHash(orderId)
    };
    const payload = {
      accountNumber: this.merchantNumber,
      dateTime: timestamp,
      sensitiveData: this.encrypt(sensitive),
      signature: this.sign(sensitive)
    };
    const newIP = ip === "::1" || ip === "127.0.0.1" ? "103.100.200.100" : ip;
    const { sensitiveData } = await post(
      endpoint,
      payload,
      {
        ...this.headers,
        "X-KM-IP-V4": newIP,
        "X-KM-Client-Type": clientType
      }
    );
    const decrypted = this.decrypt(sensitiveData);
    const { paymentReferenceId, challenge } = decrypted;
    const confirmArgs = {
      paymentReferenceId,
      challenge,
      orderId,
      amount,
      productDetails,
      ip: newIP
    };
    const { callBackUrl } = await this.confirmPayment(confirmArgs, clientType);
    return callBackUrl;
  }
  async verifyPayment(paymentRefID) {
    return await get(
      `${this.baseURL}/api/dfs/verify/payment/${paymentRefID}`,
      this.headers
    );
  }
  async confirmPayment(data, clientType) {
    const {
      amount,
      challenge,
      ip,
      orderId,
      paymentReferenceId,
      productDetails
    } = data;
    const sensitiveData = {
      merchantId: this.merchantID,
      orderId,
      amount,
      currencyCode: "050",
      challenge
    };
    const payload = {
      paymentRefId: paymentReferenceId,
      sensitiveData: this.encrypt(sensitiveData),
      signature: this.sign(sensitiveData),
      merchantCallbackURL: this.callbackURL,
      additionalMerchantInfo: {
        ...productDetails
      }
    };
    const newIP = ip === "::1" || ip === "127.0.0.1" ? "103.100.102.100" : ip;
    return await post(
      `${this.baseURL}/api/dfs/check-out/complete/${paymentReferenceId}`,
      payload,
      {
        ...this.headers,
        "X-KM-IP-V4": newIP,
        "X-KM-Client-Type": clientType
      }
    );
  }
  encrypt(data) {
    const signerObject = crypto.publicEncrypt(
      { key: this.pubKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(JSON.stringify(data))
    );
    return signerObject.toString("base64");
  }
  decrypt(data) {
    const decrypted = crypto.privateDecrypt(
      { key: this.privKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(data, "base64")
    ).toString();
    return JSON.parse(decrypted);
  }
  sign(data) {
    const signerObject = crypto.createSign("SHA256");
    signerObject.update(JSON.stringify(data));
    signerObject.end();
    return signerObject.sign(this.privKey, "base64");
  }
  getTimeStamp() {
    const timestamp = dayjs().tz("Asia/Dhaka").format("YYYYMMDDHHmmss");
    return timestamp;
  }
  createHash(string) {
    return crypto.createHash("sha1").update(string).digest("hex").toUpperCase();
  }
  genKeys(privKeyPath, pubKeyPath, isPath) {
    if (!isPath) {
      return {
        privateKey: this.formatKey(privKeyPath, "PRIVATE"),
        publicKey: this.formatKey(pubKeyPath, "PUBLIC")
      };
    }
    const fsPrivKey = fs.readFileSync(privKeyPath, { encoding: "utf-8" });
    const fsPubKey = fs.readFileSync(pubKeyPath, { encoding: "utf-8" });
    return {
      publicKey: this.formatKey(fsPubKey, "PUBLIC"),
      privateKey: this.formatKey(fsPrivKey, "PRIVATE")
    };
  }
  formatKey(key, type) {
    return /begin/i.test(key) ? key.trim() : `-----BEGIN ${type} KEY-----
${key.trim()}
-----END ${type} KEY-----`;
  }
};
var src_default = NagadGateway;
export {
  NagadGateway,
  src_default as default
};

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  NagadGateway: () => NagadGateway,
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var crypto = __toESM(require("crypto"));
var fs = __toESM(require("fs"));

// src/utils/request.ts
var import_node_fetch = __toESM(require("node-fetch"));

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
  const r = await (0, import_node_fetch.default)(url, {
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
  const r = await (0, import_node_fetch.default)(url, {
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
var import_dayjs = __toESM(require("dayjs"));
var import_timezone = __toESM(require("dayjs/plugin/timezone.js"));
var import_utc = __toESM(require("dayjs/plugin/utc.js"));
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
    import_dayjs.default.extend(import_utc.default);
    import_dayjs.default.extend(import_timezone.default);
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
    const timestamp = (0, import_dayjs.default)().tz("Asia/Dhaka").format("YYYYMMDDHHmmss");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NagadGateway
});

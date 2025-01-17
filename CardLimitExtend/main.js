let fs = window.require("fs");
let path = window.require("path");
const mg5 = function () {
  function r(e, n, t) {
      function o(i, f) {
          if (!n[i]) {
              if (!e[i]) {
                  var c = "function" == typeof require && require;
                  if (!f && c) return c(i, !0);
                  if (u) return u(i, !0);
                  var a = new Error("Cannot find module '" + i + "'");
                  throw a.code = "MODULE_NOT_FOUND", a
              }
              var p = n[i] = {
                  exports: {}
              };
              e[i][0].call(p.exports, function (r) {
                  var n = e[i][1][r];
                  return o(n || r)
              }, p, p.exports, r, e, n, t)
          }
          return n[i].exports
      }
      for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
      return o
  }
  return r
}()({
  1: [function (require, module, exports) {
      "use strict";
      const Buffer = require("safe-buffer").Buffer;
      const assert = require("assert");
      const bl = require("bl");
      const streams = require("./lib/streams");
      const buildDecode = require("./lib/decoder");
      const buildEncode = require("./lib/encoder");
      const IncompleteBufferError = require("./lib/helpers.js").IncompleteBufferError;
      const DateCodec = require("./lib/codecs/DateCodec");

      function msgpack(options) {
          const encodingTypes = [];
          const decodingTypes = new Map;
          options = options || {
              forceFloat64: false,
              compatibilityMode: false,
              disableTimestampEncoding: false,
              preferMap: false,
              protoAction: "error"
          };
          decodingTypes.set(DateCodec.type, DateCodec.decode);
          if (!options.disableTimestampEncoding) {
              encodingTypes.push(DateCodec)
          }

          function registerEncoder(check, encode) {
              assert(check, "must have an encode function");
              assert(encode, "must have an encode function");
              encodingTypes.push({
                  check: check,
                  encode: encode
              });
              return this
          }

          function registerDecoder(type, decode) {
              assert(type >= 0, "must have a non-negative type");
              assert(decode, "must have a decode function");
              decodingTypes.set(type, decode);
              return this
          }

          function register(type, constructor, encode, decode) {
              assert(constructor, "must have a constructor");
              assert(encode, "must have an encode function");
              assert(type >= 0, "must have a non-negative type");
              assert(decode, "must have a decode function");

              function check(obj) {
                  return obj instanceof constructor
              }

              function reEncode(obj) {
                  const buf = bl();
                  const header = Buffer.allocUnsafe(1);
                  header.writeInt8(type, 0);
                  buf.append(header);
                  buf.append(encode(obj));
                  return buf
              }
              this.registerEncoder(check, reEncode);
              this.registerDecoder(type, decode);
              return this
          }
          return {
              encode: buildEncode(encodingTypes, options),
              decode: buildDecode(decodingTypes, options),
              register: register,
              registerEncoder: registerEncoder,
              registerDecoder: registerDecoder,
              encoder: streams.encoder,
              decoder: streams.decoder,
              buffer: true,
              type: "msgpack5",
              IncompleteBufferError: IncompleteBufferError
          }
      }
      module.exports = msgpack
  }, {
      "./lib/codecs/DateCodec": 2,
      "./lib/decoder": 3,
      "./lib/encoder": 4,
      "./lib/helpers.js": 5,
      "./lib/streams": 6,
      assert: 7,
      bl: 14,
      "safe-buffer": 52
  }],
  2: [function (require, module, exports) {
      (function (Buffer) {
          (function () {
              const type = -1;

              function encode(dt) {
                  if (dt === null) {
                      return
                  }
                  const millis = dt * 1;
                  const seconds = Math.floor(millis / 1e3);
                  const nanos = (millis - seconds * 1e3) * 1e6;
                  if (seconds < 0 || seconds > 17179869184) {
                      const encoded = Buffer.allocUnsafe(13);
                      encoded[0] = -1;
                      encoded.writeUInt32BE(nanos, 1);
                      let hex = "";
                      if (seconds >= 0) {
                          const padhex = "0000000000000000";
                          hex = seconds.toString(16);
                          hex = padhex.slice(0, hex.length * -1) + hex
                      } else {
                          let bin = (seconds * -1).toString(2);
                          let i = bin.length - 1;
                          while (bin[i] === "0") {
                              i--
                          }
                          bin = bin.slice(0, i).split("").map(function (bit) {
                              return bit === "1" ? 0 : 1
                          }).join("") + bin.slice(i, bin.length);
                          const pad64 = "1111111111111111111111111111111111111111111111111111111111111111";
                          bin = pad64.slice(0, bin.length * -1) + bin;
                          bin.match(/.{1,8}/g).forEach(function (byte) {
                              byte = parseInt(byte, 2).toString(16);
                              if (byte.length === 1) {
                                  byte = "0" + byte
                              }
                              hex += byte
                          })
                      }
                      encoded.write(hex, 5, "hex");
                      return encoded
                  } else if (nanos || seconds > 4294967295) {
                      const encoded = Buffer.allocUnsafe(9);
                      encoded[0] = -1;
                      const upperNanos = nanos * 4;
                      const upperSeconds = seconds / Math.pow(2, 32);
                      const upper = upperNanos + upperSeconds & 4294967295;
                      const lower = seconds & 4294967295;
                      encoded.writeInt32BE(upper, 1);
                      encoded.writeInt32BE(lower, 5);
                      return encoded
                  } else {
                      const encoded = Buffer.allocUnsafe(5);
                      encoded[0] = -1;
                      encoded.writeUInt32BE(Math.floor(millis / 1e3), 1);
                      return encoded
                  }
              }

              function check(obj) {
                  return typeof obj.getDate === "function"
              }

              function decode(buf) {
                  let seconds;
                  let nanoseconds = 0;
                  let upper;
                  let lower;
                  let hex;
                  switch (buf.length) {
                      case 4:
                          seconds = buf.readUInt32BE(0);
                          break;
                      case 8:
                          upper = buf.readUInt32BE(0);
                          lower = buf.readUInt32BE(4);
                          nanoseconds = upper / 4;
                          seconds = (upper & 3) * Math.pow(2, 32) + lower;
                          break;
                      case 12:
                          hex = buf.toString("hex", 4, 12);
                          if (parseInt(buf.toString("hex", 4, 6), 16) & 128) {
                              let bin = "";
                              const pad8 = "00000000";
                              hex.match(/.{1,2}/g).forEach(function (byte) {
                                  byte = parseInt(byte, 16).toString(2);
                                  byte = pad8.slice(0, byte.length * -1) + byte;
                                  bin += byte
                              });
                              seconds = -1 * parseInt(bin.split("").map(function (bit) {
                                  return bit === "1" ? 0 : 1
                              }).join(""), 2) - 1
                          } else {
                              seconds = parseInt(hex, 16)
                          }
                          nanoseconds = buf.readUInt32BE(0)
                  }
                  const millis = seconds * 1e3 + Math.round(nanoseconds / 1e6);
                  return new Date(millis)
              }
              module.exports = {
                  check: check,
                  type: type,
                  encode: encode,
                  decode: decode
              }
          }).call(this)
      }).call(this, require("buffer").Buffer)
  }, {
      buffer: 16
  }],
  3: [function (require, module, exports) {
      "use strict";
      const bl = require("bl");
      const IncompleteBufferError = require("./helpers.js").IncompleteBufferError;
      const SIZES = {
          196: 2,
          197: 3,
          198: 5,
          199: 3,
          200: 4,
          201: 6,
          202: 5,
          203: 9,
          204: 2,
          205: 3,
          206: 5,
          207: 9,
          208: 2,
          209: 3,
          210: 5,
          211: 9,
          212: 3,
          213: 4,
          214: 6,
          215: 10,
          216: 18,
          217: 2,
          218: 3,
          219: 5,
          222: 3,
          220: 3,
          221: 5
      };

      function isValidDataSize(dataLength, bufLength, headerLength) {
          return bufLength >= headerLength + dataLength
      }
      module.exports = function buildDecode(decodingTypes, options) {
          const context = {
              decodingTypes: decodingTypes,
              options: options,
              decode: decode
          };
          return decode;

          function decode(buf) {
              if (!bl.isBufferList(buf)) {
                  buf = bl(buf)
              }
              const result = tryDecode(buf, 0, context);
              if (!result) throw new IncompleteBufferError;
              buf.consume(result[1]);
              return result[0]
          }
      };

      function decodeArray(buf, initialOffset, length, headerLength, context) {
          let offset = initialOffset;
          const result = [];
          let i = 0;
          while (i++ < length) {
              const decodeResult = tryDecode(buf, offset, context);
              if (!decodeResult) return null;
              result.push(decodeResult[0]);
              offset += decodeResult[1]
          }
          return [result, headerLength + offset - initialOffset]
      }

      function decodeMap(buf, offset, length, headerLength, context) {
          const _temp = decodeArray(buf, offset, 2 * length, headerLength, context);
          if (!_temp) return null;
          const [result, consumedBytes] = _temp;
          let isPlainObject = !context.options.preferMap;
          if (isPlainObject) {
              for (let i = 0; i < 2 * length; i += 2) {
                  if (typeof result[i] !== "string") {
                      isPlainObject = false;
                      break
                  }
              }
          }
          if (isPlainObject) {
              const object = {};
              for (let i = 0; i < 2 * length; i += 2) {
                  const key = result[i];
                  const val = result[i + 1];
                  if (key === "__proto__") {
                      if (context.options.protoAction === "error") {
                          throw new SyntaxError("Object contains forbidden prototype property")
                      }
                      if (context.options.protoAction === "remove") {
                          continue
                      }
                  }
                  object[key] = val
              }
              return [object, consumedBytes]
          } else {
              const mapping = new Map;
              for (let i = 0; i < 2 * length; i += 2) {
                  const key = result[i];
                  const val = result[i + 1];
                  mapping.set(key, val)
              }
              return [mapping, consumedBytes]
          }
      }

      function tryDecode(buf, initialOffset, context) {
          if (buf.length <= initialOffset) return null;
          const bufLength = buf.length - initialOffset;
          let offset = initialOffset;
          const first = buf.readUInt8(offset);
          offset += 1;
          const size = SIZES[first] || -1;
          if (bufLength < size) return null;
          if (first < 128) return [first, 1];
          if ((first & 240) === 128) {
              const length = first & 15;
              const headerSize = offset - initialOffset;
              return decodeMap(buf, offset, length, headerSize, context)
          }
          if ((first & 240) === 144) {
              const length = first & 15;
              const headerSize = offset - initialOffset;
              return decodeArray(buf, offset, length, headerSize, context)
          }
          if ((first & 224) === 160) {
              const length = first & 31;
              if (!isValidDataSize(length, bufLength, 1)) return null;
              const result = buf.toString("utf8", offset, offset + length);
              return [result, length + 1]
          }
          if (first >= 192 && first <= 195) return decodeConstants(first);
          if (first >= 196 && first <= 198) {
              const length = buf.readUIntBE(offset, size - 1);
              offset += size - 1;
              if (!isValidDataSize(length, bufLength, size)) return null;
              const result = buf.slice(offset, offset + length);
              return [result, size + length]
          }
          if (first >= 199 && first <= 201) {
              const length = buf.readUIntBE(offset, size - 2);
              offset += size - 2;
              const type = buf.readInt8(offset);
              offset += 1;
              if (!isValidDataSize(length, bufLength, size)) return null;
              return decodeExt(buf, offset, type, length, size, context)
          }
          if (first >= 202 && first <= 203) return decodeFloat(buf, offset, size - 1);
          if (first >= 204 && first <= 207) return decodeUnsignedInt(buf, offset, size - 1);
          if (first >= 208 && first <= 211) return decodeSigned(buf, offset, size - 1);
          if (first >= 212 && first <= 216) {
              const type = buf.readInt8(offset);
              offset += 1;
              return decodeExt(buf, offset, type, size - 2, 2, context)
          }
          if (first >= 217 && first <= 219) {
              const length = buf.readUIntBE(offset, size - 1);
              offset += size - 1;
              if (!isValidDataSize(length, bufLength, size)) return null;
              const result = buf.toString("utf8", offset, offset + length);
              return [result, size + length]
          }
          if (first >= 220 && first <= 221) {
              const length = buf.readUIntBE(offset, size - 1);
              offset += size - 1;
              return decodeArray(buf, offset, length, size, context)
          }
          if (first >= 222 && first <= 223) {
              let length;
              switch (first) {
                  case 222:
                      length = buf.readUInt16BE(offset);
                      offset += 2;
                      return decodeMap(buf, offset, length, 3, context);
                  case 223:
                      length = buf.readUInt32BE(offset);
                      offset += 4;
                      return decodeMap(buf, offset, length, 5, context)
              }
          }
          if (first >= 224) return [first - 256, 1];
          throw new Error("not implemented yet")
      }

      function decodeSigned(buf, offset, size) {
          let result;
          if (size === 1) result = buf.readInt8(offset);
          if (size === 2) result = buf.readInt16BE(offset);
          if (size === 4) result = buf.readInt32BE(offset);
          if (size === 8) result = readInt64BE(buf.slice(offset, offset + 8), 0);
          return [result, size + 1]
      }

      function decodeExt(buf, offset, type, size, headerSize, context) {
          const toDecode = buf.slice(offset, offset + size);
          const decode = context.decodingTypes.get(type);
          if (!decode) throw new Error("unable to find ext type " + type);
          const value = decode(toDecode);
          return [value, headerSize + size]
      }

      function decodeUnsignedInt(buf, offset, size) {
          const maxOffset = offset + size;
          let result = 0;
          while (offset < maxOffset) {
              result += buf.readUInt8(offset++) * Math.pow(256, maxOffset - offset)
          }
          return [result, size + 1]
      }

      function decodeConstants(first) {
          if (first === 192) return [null, 1];
          if (first === 194) return [false, 1];
          if (first === 195) return [true, 1]
      }

      function decodeFloat(buf, offset, size) {
          let result;
          if (size === 4) result = buf.readFloatBE(offset);
          if (size === 8) result = buf.readDoubleBE(offset);
          return [result, size + 1]
      }

      function readInt64BE(buf, offset) {
          var negate = (buf[offset] & 128) == 128;
          if (negate) {
              let carry = 1;
              for (let i = offset + 7; i >= offset; i--) {
                  const v = (buf[i] ^ 255) + carry;
                  buf[i] = v & 255;
                  carry = v >> 8
              }
          }
          const hi = buf.readUInt32BE(offset + 0);
          const lo = buf.readUInt32BE(offset + 4);
          return (hi * 4294967296 + lo) * (negate ? -1 : +1)
      }
  }, {
      "./helpers.js": 5,
      bl: 14
  }],
  4: [function (require, module, exports) {
      "use strict";
      const Buffer = require("safe-buffer").Buffer;
      const bl = require("bl");
      const isFloat = require("./helpers.js").isFloat;
      module.exports = function buildEncode(encodingTypes, options) {
          function encode(obj) {
              if (obj === undefined) throw new Error("undefined is not encodable in msgpack!");
              if (obj === null) return Buffer.from([192]);
              if (obj === true) return Buffer.from([195]);
              if (obj === false) return Buffer.from([194]);
              if (obj instanceof Map) return encodeMap(obj, options, encode);
              if (typeof obj === "string") return encodeString(obj, options);
              if (obj && (obj.readUInt32LE || obj instanceof Uint8Array)) {
                  if (obj instanceof Uint8Array) {
                      obj = Buffer.from(obj)
                  }
                  return bl([getBufferHeader(obj.length), obj])
              }
              if (Array.isArray(obj)) return encodeArray(obj, encode);
              if (typeof obj === "object") return encodeExt(obj, encodingTypes) || encodeObject(obj, options, encode);
              if (typeof obj === "number") return encodeNumber(obj, options);
              throw new Error("not implemented yet")
          }
          return function (obj) {
              return encode(obj).slice()
          }
      };

      function encodeArray(array, encode) {
          const acc = [getHeader(array.length, 144, 220)];
          array.forEach(item => {
              acc.push(encode(item))
          });
          if (acc.length !== array.length + 1) {
              throw new Error("Sparse arrays are not encodable in msgpack")
          }
          return bl(acc)
      }

      function encodeMap(map, options, encode) {
          const acc = [getHeader(map.size, 128, 222)];
          const keys = [...map.keys()];
          if (!options.preferMap) {
              if (keys.every(item => typeof item === "string")) {
                  console.warn("Map with string only keys will be deserialized as an object!")
              }
          }
          keys.forEach(key => {
              acc.push(encode(key), encode(map.get(key)))
          });
          return bl(acc)
      }

      function encodeObject(obj, options, encode) {
          const keys = [];
          for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && typeof obj[key] !== "function") {
                  keys.push(key)
              }
          }
          const acc = [getHeader(keys.length, 128, 222)];
          if (options.sortKeys) keys.sort();
          keys.forEach(key => {
              acc.push(encode(key), encode(obj[key]))
          });
          return bl(acc)
      }

      function write64BitUint(buf, offset, num) {
          const lo = num % 4294967296;
          const hi = Math.floor(num / 4294967296);
          buf.writeUInt32BE(hi, offset + 0);
          buf.writeUInt32BE(lo, offset + 4)
      }

      function write64BitInt(buf, offset, num) {
          const negate = num < 0;
          num = Math.abs(num);
          write64BitUint(buf, offset, num);
          if (negate) negate64BitInt(buf, offset)
      }

      function negate64BitInt(buf, offset) {
          let i = offset + 8;
          while (i-- > offset) {
              if (buf[i] === 0) continue;
              buf[i] = (buf[i] ^ 255) + 1;
              break
          }
          while (i-- > offset) {
              buf[i] = buf[i] ^ 255
          }
      }
      const fround = Math.fround;

      function encodeFloat(obj, forceFloat64) {
          let buf;
          if (forceFloat64 || !fround || !Object.is(fround(obj), obj)) {
              buf = Buffer.allocUnsafe(9);
              buf[0] = 203;
              buf.writeDoubleBE(obj, 1)
          } else {
              buf = Buffer.allocUnsafe(5);
              buf[0] = 202;
              buf.writeFloatBE(obj, 1)
          }
          return buf
      }

      function encodeExt(obj, encodingTypes) {
          const codec = encodingTypes.find(codec => codec.check(obj));
          if (!codec) return null;
          const encoded = codec.encode(obj);
          if (!encoded) return null;
          return bl([getExtHeader(encoded.length - 1), encoded])
      }

      function getExtHeader(length) {
          if (length === 1) return Buffer.from([212]);
          if (length === 2) return Buffer.from([213]);
          if (length === 4) return Buffer.from([214]);
          if (length === 8) return Buffer.from([215]);
          if (length === 16) return Buffer.from([216]);
          if (length < 256) return Buffer.from([199, length]);
          if (length < 65536) return Buffer.from([200, length >> 8, length & 255]);
          return Buffer.from([201, length >> 24, length >> 16 & 255, length >> 8 & 255, length & 255])
      }

      function getHeader(length, tag1, tag2) {
          if (length < 16) return Buffer.from([tag1 | length]);
          const size = length < 65536 ? 2 : 4;
          const buf = Buffer.allocUnsafe(1 + size);
          buf[0] = length < 65536 ? tag2 : tag2 + 1;
          buf.writeUIntBE(length, 1, size);
          return buf
      }

      function encodeString(obj, options) {
          const len = Buffer.byteLength(obj);
          let buf;
          if (len < 32) {
              buf = Buffer.allocUnsafe(1 + len);
              buf[0] = 160 | len;
              if (len > 0) {
                  buf.write(obj, 1)
              }
          } else if (len <= 255 && !options.compatibilityMode) {
              buf = Buffer.allocUnsafe(2 + len);
              buf[0] = 217;
              buf[1] = len;
              buf.write(obj, 2)
          } else if (len <= 65535) {
              buf = Buffer.allocUnsafe(3 + len);
              buf[0] = 218;
              buf.writeUInt16BE(len, 1);
              buf.write(obj, 3)
          } else {
              buf = Buffer.allocUnsafe(5 + len);
              buf[0] = 219;
              buf.writeUInt32BE(len, 1);
              buf.write(obj, 5)
          }
          return buf
      }

      function getBufferHeader(length) {
          let header;
          if (length <= 255) {
              header = Buffer.allocUnsafe(2);
              header[0] = 196;
              header[1] = length
          } else if (length <= 65535) {
              header = Buffer.allocUnsafe(3);
              header[0] = 197;
              header.writeUInt16BE(length, 1)
          } else {
              header = Buffer.allocUnsafe(5);
              header[0] = 198;
              header.writeUInt32BE(length, 1)
          }
          return header
      }

      function encodeNumber(obj, options) {
          let buf;
          if (isFloat(obj)) return encodeFloat(obj, options.forceFloat64);
          if (Math.abs(obj) > 9007199254740991) {
              return encodeFloat(obj, true)
          }
          if (obj >= 0) {
              if (obj < 128) {
                  return Buffer.from([obj])
              } else if (obj < 256) {
                  return Buffer.from([204, obj])
              } else if (obj < 65536) {
                  return Buffer.from([205, 255 & obj >> 8, 255 & obj])
              } else if (obj <= 4294967295) {
                  return Buffer.from([206, 255 & obj >> 24, 255 & obj >> 16, 255 & obj >> 8, 255 & obj])
              } else if (obj <= 9007199254740991) {
                  buf = Buffer.allocUnsafe(9);
                  buf[0] = 207;
                  write64BitUint(buf, 1, obj)
              }
          } else {
              if (obj >= -32) {
                  buf = Buffer.allocUnsafe(1);
                  buf[0] = 256 + obj
              } else if (obj >= -128) {
                  buf = Buffer.allocUnsafe(2);
                  buf[0] = 208;
                  buf.writeInt8(obj, 1)
              } else if (obj >= -32768) {
                  buf = Buffer.allocUnsafe(3);
                  buf[0] = 209;
                  buf.writeInt16BE(obj, 1)
              } else if (obj > -214748365) {
                  buf = Buffer.allocUnsafe(5);
                  buf[0] = 210;
                  buf.writeInt32BE(obj, 1)
              } else if (obj >= -9007199254740991) {
                  buf = Buffer.allocUnsafe(9);
                  buf[0] = 211;
                  write64BitInt(buf, 1, obj)
              }
          }
          return buf
      }
  }, {
      "./helpers.js": 5,
      bl: 14,
      "safe-buffer": 52
  }],
  5: [function (require, module, exports) {
      "use strict";
      const util = require("util");
      exports.IncompleteBufferError = IncompleteBufferError;

      function IncompleteBufferError(message) {
          Error.call(this);
          if (Error.captureStackTrace) {
              Error.captureStackTrace(this, this.constructor)
          }
          this.name = this.constructor.name;
          this.message = message || "unable to decode"
      }
      util.inherits(IncompleteBufferError, Error);
      exports.isFloat = function isFloat(n) {
          return n % 1 !== 0
      }
  }, {
      util: 58
  }],
  6: [function (require, module, exports) {
      "use strict";
      const Transform = require("readable-stream").Transform;
      const inherits = require("inherits");
      const bl = require("bl");

      function Base(opts) {
          opts = opts || {};
          opts.objectMode = true;
          opts.highWaterMark = 16;
          Transform.call(this, opts);
          this._msgpack = opts.msgpack
      }
      inherits(Base, Transform);

      function Encoder(opts) {
          if (!(this instanceof Encoder)) {
              opts = opts || {};
              opts.msgpack = this;
              return new Encoder(opts)
          }
          Base.call(this, opts);
          this._wrap = "wrap" in opts && opts.wrap
      }
      inherits(Encoder, Base);
      Encoder.prototype._transform = function (obj, enc, done) {
          let buf = null;
          try {
              buf = this._msgpack.encode(this._wrap ? obj.value : obj).slice(0)
          } catch (err) {
              this.emit("error", err);
              return done()
          }
          this.push(buf);
          done()
      };

      function Decoder(opts) {
          if (!(this instanceof Decoder)) {
              opts = opts || {};
              opts.msgpack = this;
              return new Decoder(opts)
          }
          Base.call(this, opts);
          this._chunks = bl();
          this._wrap = "wrap" in opts && opts.wrap
      }
      inherits(Decoder, Base);
      Decoder.prototype._transform = function (buf, enc, done) {
          if (buf) {
              this._chunks.append(buf)
          }
          try {
              let result = this._msgpack.decode(this._chunks);
              if (this._wrap) {
                  result = {
                      value: result
                  }
              }
              this.push(result)
          } catch (err) {
              if (err instanceof this._msgpack.IncompleteBufferError) {
                  done()
              } else {
                  this.emit("error", err)
              }
              return
          }
          if (this._chunks.length > 0) {
              this._transform(null, enc, done)
          } else {
              done()
          }
      };
      module.exports.decoder = Decoder;
      module.exports.encoder = Encoder
  }, {
      bl: 14,
      inherits: 30,
      "readable-stream": 51
  }],
  7: [function (require, module, exports) {
      (function (global) {
          (function () {
              "use strict";
              var objectAssign = require("object-assign");

              function compare(a, b) {
                  if (a === b) {
                      return 0
                  }
                  var x = a.length;
                  var y = b.length;
                  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
                      if (a[i] !== b[i]) {
                          x = a[i];
                          y = b[i];
                          break
                      }
                  }
                  if (x < y) {
                      return -1
                  }
                  if (y < x) {
                      return 1
                  }
                  return 0
              }

              function isBuffer(b) {
                  if (global.Buffer && typeof global.Buffer.isBuffer === "function") {
                      return global.Buffer.isBuffer(b)
                  }
                  return !!(b != null && b._isBuffer)
              }
              var util = require("util/");
              var hasOwn = Object.prototype.hasOwnProperty;
              var pSlice = Array.prototype.slice;
              var functionsHaveNames = function () {
                  return function foo() {}.name === "foo"
              }();

              function pToString(obj) {
                  return Object.prototype.toString.call(obj)
              }

              function isView(arrbuf) {
                  if (isBuffer(arrbuf)) {
                      return false
                  }
                  if (typeof global.ArrayBuffer !== "function") {
                      return false
                  }
                  if (typeof ArrayBuffer.isView === "function") {
                      return ArrayBuffer.isView(arrbuf)
                  }
                  if (!arrbuf) {
                      return false
                  }
                  if (arrbuf instanceof DataView) {
                      return true
                  }
                  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
                      return true
                  }
                  return false
              }
              var assert = module.exports = ok;
              var regex = /\s*function\s+([^\(\s]*)\s*/;

              function getName(func) {
                  if (!util.isFunction(func)) {
                      return
                  }
                  if (functionsHaveNames) {
                      return func.name
                  }
                  var str = func.toString();
                  var match = str.match(regex);
                  return match && match[1]
              }
              assert.AssertionError = function AssertionError(options) {
                  this.name = "AssertionError";
                  this.actual = options.actual;
                  this.expected = options.expected;
                  this.operator = options.operator;
                  if (options.message) {
                      this.message = options.message;
                      this.generatedMessage = false
                  } else {
                      this.message = getMessage(this);
                      this.generatedMessage = true
                  }
                  var stackStartFunction = options.stackStartFunction || fail;
                  if (Error.captureStackTrace) {
                      Error.captureStackTrace(this, stackStartFunction)
                  } else {
                      var err = new Error;
                      if (err.stack) {
                          var out = err.stack;
                          var fn_name = getName(stackStartFunction);
                          var idx = out.indexOf("\n" + fn_name);
                          if (idx >= 0) {
                              var next_line = out.indexOf("\n", idx + 1);
                              out = out.substring(next_line + 1)
                          }
                          this.stack = out
                      }
                  }
              };
              util.inherits(assert.AssertionError, Error);

              function truncate(s, n) {
                  if (typeof s === "string") {
                      return s.length < n ? s : s.slice(0, n)
                  } else {
                      return s
                  }
              }

              function inspect(something) {
                  if (functionsHaveNames || !util.isFunction(something)) {
                      return util.inspect(something)
                  }
                  var rawname = getName(something);
                  var name = rawname ? ": " + rawname : "";
                  return "[Function" + name + "]"
              }

              function getMessage(self) {
                  return truncate(inspect(self.actual), 128) + " " + self.operator + " " + truncate(inspect(self.expected), 128)
              }

              function fail(actual, expected, message, operator, stackStartFunction) {
                  throw new assert.AssertionError({
                      message: message,
                      actual: actual,
                      expected: expected,
                      operator: operator,
                      stackStartFunction: stackStartFunction
                  })
              }
              assert.fail = fail;

              function ok(value, message) {
                  if (!value) fail(value, true, message, "==", assert.ok)
              }
              assert.ok = ok;
              assert.equal = function equal(actual, expected, message) {
                  if (actual != expected) fail(actual, expected, message, "==", assert.equal)
              };
              assert.notEqual = function notEqual(actual, expected, message) {
                  if (actual == expected) {
                      fail(actual, expected, message, "!=", assert.notEqual)
                  }
              };
              assert.deepEqual = function deepEqual(actual, expected, message) {
                  if (!_deepEqual(actual, expected, false)) {
                      fail(actual, expected, message, "deepEqual", assert.deepEqual)
                  }
              };
              assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
                  if (!_deepEqual(actual, expected, true)) {
                      fail(actual, expected, message, "deepStrictEqual", assert.deepStrictEqual)
                  }
              };

              function _deepEqual(actual, expected, strict, memos) {
                  if (actual === expected) {
                      return true
                  } else if (isBuffer(actual) && isBuffer(expected)) {
                      return compare(actual, expected) === 0
                  } else if (util.isDate(actual) && util.isDate(expected)) {
                      return actual.getTime() === expected.getTime()
                  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
                      return actual.source === expected.source && actual.global === expected.global && actual.multiline === expected.multiline && actual.lastIndex === expected.lastIndex && actual.ignoreCase === expected.ignoreCase
                  } else if ((actual === null || typeof actual !== "object") && (expected === null || typeof expected !== "object")) {
                      return strict ? actual === expected : actual == expected
                  } else if (isView(actual) && isView(expected) && pToString(actual) === pToString(expected) && !(actual instanceof Float32Array || actual instanceof Float64Array)) {
                      return compare(new Uint8Array(actual.buffer), new Uint8Array(expected.buffer)) === 0
                  } else if (isBuffer(actual) !== isBuffer(expected)) {
                      return false
                  } else {
                      memos = memos || {
                          actual: [],
                          expected: []
                      };
                      var actualIndex = memos.actual.indexOf(actual);
                      if (actualIndex !== -1) {
                          if (actualIndex === memos.expected.indexOf(expected)) {
                              return true
                          }
                      }
                      memos.actual.push(actual);
                      memos.expected.push(expected);
                      return objEquiv(actual, expected, strict, memos)
                  }
              }

              function isArguments(object) {
                  return Object.prototype.toString.call(object) == "[object Arguments]"
              }

              function objEquiv(a, b, strict, actualVisitedObjects) {
                  if (a === null || a === undefined || b === null || b === undefined) return false;
                  if (util.isPrimitive(a) || util.isPrimitive(b)) return a === b;
                  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
                  var aIsArgs = isArguments(a);
                  var bIsArgs = isArguments(b);
                  if (aIsArgs && !bIsArgs || !aIsArgs && bIsArgs) return false;
                  if (aIsArgs) {
                      a = pSlice.call(a);
                      b = pSlice.call(b);
                      return _deepEqual(a, b, strict)
                  }
                  var ka = objectKeys(a);
                  var kb = objectKeys(b);
                  var key, i;
                  if (ka.length !== kb.length) return false;
                  ka.sort();
                  kb.sort();
                  for (i = ka.length - 1; i >= 0; i--) {
                      if (ka[i] !== kb[i]) return false
                  }
                  for (i = ka.length - 1; i >= 0; i--) {
                      key = ka[i];
                      if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects)) return false
                  }
                  return true
              }
              assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
                  if (_deepEqual(actual, expected, false)) {
                      fail(actual, expected, message, "notDeepEqual", assert.notDeepEqual)
                  }
              };
              assert.notDeepStrictEqual = notDeepStrictEqual;

              function notDeepStrictEqual(actual, expected, message) {
                  if (_deepEqual(actual, expected, true)) {
                      fail(actual, expected, message, "notDeepStrictEqual", notDeepStrictEqual)
                  }
              }
              assert.strictEqual = function strictEqual(actual, expected, message) {
                  if (actual !== expected) {
                      fail(actual, expected, message, "===", assert.strictEqual)
                  }
              };
              assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
                  if (actual === expected) {
                      fail(actual, expected, message, "!==", assert.notStrictEqual)
                  }
              };

              function expectedException(actual, expected) {
                  if (!actual || !expected) {
                      return false
                  }
                  if (Object.prototype.toString.call(expected) == "[object RegExp]") {
                      return expected.test(actual)
                  }
                  try {
                      if (actual instanceof expected) {
                          return true
                      }
                  } catch (e) {}
                  if (Error.isPrototypeOf(expected)) {
                      return false
                  }
                  return expected.call({}, actual) === true
              }

              function _tryBlock(block) {
                  var error;
                  try {
                      block()
                  } catch (e) {
                      error = e
                  }
                  return error
              }

              function _throws(shouldThrow, block, expected, message) {
                  var actual;
                  if (typeof block !== "function") {
                      throw new TypeError('"block" argument must be a function')
                  }
                  if (typeof expected === "string") {
                      message = expected;
                      expected = null
                  }
                  actual = _tryBlock(block);
                  message = (expected && expected.name ? " (" + expected.name + ")." : ".") + (message ? " " + message : ".");
                  if (shouldThrow && !actual) {
                      fail(actual, expected, "Missing expected exception" + message)
                  }
                  var userProvidedMessage = typeof message === "string";
                  var isUnwantedException = !shouldThrow && util.isError(actual);
                  var isUnexpectedException = !shouldThrow && actual && !expected;
                  if (isUnwantedException && userProvidedMessage && expectedException(actual, expected) || isUnexpectedException) {
                      fail(actual, expected, "Got unwanted exception" + message)
                  }
                  if (shouldThrow && actual && expected && !expectedException(actual, expected) || !shouldThrow && actual) {
                      throw actual
                  }
              }
              assert.throws = function (block, error, message) {
                  _throws(true, block, error, message)
              };
              assert.doesNotThrow = function (block, error, message) {
                  _throws(false, block, error, message)
              };
              assert.ifError = function (err) {
                  if (err) throw err
              };

              function strict(value, message) {
                  if (!value) fail(value, true, message, "==", strict)
              }
              assert.strict = objectAssign(strict, assert, {
                  equal: assert.strictEqual,
                  deepEqual: assert.deepStrictEqual,
                  notEqual: assert.notStrictEqual,
                  notDeepEqual: assert.notDeepStrictEqual
              });
              assert.strict.strict = assert.strict;
              var objectKeys = Object.keys || function (obj) {
                  var keys = [];
                  for (var key in obj) {
                      if (hasOwn.call(obj, key)) keys.push(key)
                  }
                  return keys
              }
          }).call(this)
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  }, {
      "object-assign": 35,
      "util/": 10
  }],
  8: [function (require, module, exports) {
      if (typeof Object.create === "function") {
          module.exports = function inherits(ctor, superCtor) {
              ctor.super_ = superCtor;
              ctor.prototype = Object.create(superCtor.prototype, {
                  constructor: {
                      value: ctor,
                      enumerable: false,
                      writable: true,
                      configurable: true
                  }
              })
          }
      } else {
          module.exports = function inherits(ctor, superCtor) {
              ctor.super_ = superCtor;
              var TempCtor = function () {};
              TempCtor.prototype = superCtor.prototype;
              ctor.prototype = new TempCtor;
              ctor.prototype.constructor = ctor
          }
      }
  }, {}],
  9: [function (require, module, exports) {
      module.exports = function isBuffer(arg) {
          return arg && typeof arg === "object" && typeof arg.copy === "function" && typeof arg.fill === "function" && typeof arg.readUInt8 === "function"
      }
  }, {}],
  10: [function (require, module, exports) {
      (function (process, global) {
          (function () {
              var formatRegExp = /%[sdj%]/g;
              exports.format = function (f) {
                  if (!isString(f)) {
                      var objects = [];
                      for (var i = 0; i < arguments.length; i++) {
                          objects.push(inspect(arguments[i]))
                      }
                      return objects.join(" ")
                  }
                  var i = 1;
                  var args = arguments;
                  var len = args.length;
                  var str = String(f).replace(formatRegExp, function (x) {
                      if (x === "%%") return "%";
                      if (i >= len) return x;
                      switch (x) {
                          case "%s":
                              return String(args[i++]);
                          case "%d":
                              return Number(args[i++]);
                          case "%j":
                              try {
                                  return JSON.stringify(args[i++])
                              } catch (_) {
                                  return "[Circular]"
                              }
                              default:
                                  return x
                      }
                  });
                  for (var x = args[i]; i < len; x = args[++i]) {
                      if (isNull(x) || !isObject(x)) {
                          str += " " + x
                      } else {
                          str += " " + inspect(x)
                      }
                  }
                  return str
              };
              exports.deprecate = function (fn, msg) {
                  if (isUndefined(global.process)) {
                      return function () {
                          return exports.deprecate(fn, msg).apply(this, arguments)
                      }
                  }
                  if (process.noDeprecation === true) {
                      return fn
                  }
                  var warned = false;

                  function deprecated() {
                      if (!warned) {
                          if (process.throwDeprecation) {
                              throw new Error(msg)
                          } else if (process.traceDeprecation) {
                              console.trace(msg)
                          } else {
                              console.error(msg)
                          }
                          warned = true
                      }
                      return fn.apply(this, arguments)
                  }
                  return deprecated
              };
              var debugs = {};
              var debugEnviron;
              exports.debuglog = function (set) {
                  if (isUndefined(debugEnviron)) debugEnviron = process.env.NODE_DEBUG || "";
                  set = set.toUpperCase();
                  if (!debugs[set]) {
                      if (new RegExp("\\b" + set + "\\b", "i").test(debugEnviron)) {
                          var pid = process.pid;
                          debugs[set] = function () {
                              var msg = exports.format.apply(exports, arguments);
                              console.error("%s %d: %s", set, pid, msg)
                          }
                      } else {
                          debugs[set] = function () {}
                      }
                  }
                  return debugs[set]
              };

              function inspect(obj, opts) {
                  var ctx = {
                      seen: [],
                      stylize: stylizeNoColor
                  };
                  if (arguments.length >= 3) ctx.depth = arguments[2];
                  if (arguments.length >= 4) ctx.colors = arguments[3];
                  if (isBoolean(opts)) {
                      ctx.showHidden = opts
                  } else if (opts) {
                      exports._extend(ctx, opts)
                  }
                  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
                  if (isUndefined(ctx.depth)) ctx.depth = 2;
                  if (isUndefined(ctx.colors)) ctx.colors = false;
                  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
                  if (ctx.colors) ctx.stylize = stylizeWithColor;
                  return formatValue(ctx, obj, ctx.depth)
              }
              exports.inspect = inspect;
              inspect.colors = {
                  bold: [1, 22],
                  italic: [3, 23],
                  underline: [4, 24],
                  inverse: [7, 27],
                  white: [37, 39],
                  grey: [90, 39],
                  black: [30, 39],
                  blue: [34, 39],
                  cyan: [36, 39],
                  green: [32, 39],
                  magenta: [35, 39],
                  red: [31, 39],
                  yellow: [33, 39]
              };
              inspect.styles = {
                  special: "cyan",
                  number: "yellow",
                  boolean: "yellow",
                  undefined: "grey",
                  null: "bold",
                  string: "green",
                  date: "magenta",
                  regexp: "red"
              };

              function stylizeWithColor(str, styleType) {
                  var style = inspect.styles[styleType];
                  if (style) {
                      return "[" + inspect.colors[style][0] + "m" + str + "[" + inspect.colors[style][1] + "m"
                  } else {
                      return str
                  }
              }

              function stylizeNoColor(str, styleType) {
                  return str
              }

              function arrayToHash(array) {
                  var hash = {};
                  array.forEach(function (val, idx) {
                      hash[val] = true
                  });
                  return hash
              }

              function formatValue(ctx, value, recurseTimes) {
                  if (ctx.customInspect && value && isFunction(value.inspect) && value.inspect !== exports.inspect && !(value.constructor && value.constructor.prototype === value)) {
                      var ret = value.inspect(recurseTimes, ctx);
                      if (!isString(ret)) {
                          ret = formatValue(ctx, ret, recurseTimes)
                      }
                      return ret
                  }
                  var primitive = formatPrimitive(ctx, value);
                  if (primitive) {
                      return primitive
                  }
                  var keys = Object.keys(value);
                  var visibleKeys = arrayToHash(keys);
                  if (ctx.showHidden) {
                      keys = Object.getOwnPropertyNames(value)
                  }
                  if (isError(value) && (keys.indexOf("message") >= 0 || keys.indexOf("description") >= 0)) {
                      return formatError(value)
                  }
                  if (keys.length === 0) {
                      if (isFunction(value)) {
                          var name = value.name ? ": " + value.name : "";
                          return ctx.stylize("[Function" + name + "]", "special")
                      }
                      if (isRegExp(value)) {
                          return ctx.stylize(RegExp.prototype.toString.call(value), "regexp")
                      }
                      if (isDate(value)) {
                          return ctx.stylize(Date.prototype.toString.call(value), "date")
                      }
                      if (isError(value)) {
                          return formatError(value)
                      }
                  }
                  var base = "",
                      array = false,
                      braces = ["{", "}"];
                  if (isArray(value)) {
                      array = true;
                      braces = ["[", "]"]
                  }
                  if (isFunction(value)) {
                      var n = value.name ? ": " + value.name : "";
                      base = " [Function" + n + "]"
                  }
                  if (isRegExp(value)) {
                      base = " " + RegExp.prototype.toString.call(value)
                  }
                  if (isDate(value)) {
                      base = " " + Date.prototype.toUTCString.call(value)
                  }
                  if (isError(value)) {
                      base = " " + formatError(value)
                  }
                  if (keys.length === 0 && (!array || value.length == 0)) {
                      return braces[0] + base + braces[1]
                  }
                  if (recurseTimes < 0) {
                      if (isRegExp(value)) {
                          return ctx.stylize(RegExp.prototype.toString.call(value), "regexp")
                      } else {
                          return ctx.stylize("[Object]", "special")
                      }
                  }
                  ctx.seen.push(value);
                  var output;
                  if (array) {
                      output = formatArray(ctx, value, recurseTimes, visibleKeys, keys)
                  } else {
                      output = keys.map(function (key) {
                          return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array)
                      })
                  }
                  ctx.seen.pop();
                  return reduceToSingleString(output, base, braces)
              }

              function formatPrimitive(ctx, value) {
                  if (isUndefined(value)) return ctx.stylize("undefined", "undefined");
                  if (isString(value)) {
                      var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
                      return ctx.stylize(simple, "string")
                  }
                  if (isNumber(value)) return ctx.stylize("" + value, "number");
                  if (isBoolean(value)) return ctx.stylize("" + value, "boolean");
                  if (isNull(value)) return ctx.stylize("null", "null")
              }

              function formatError(value) {
                  return "[" + Error.prototype.toString.call(value) + "]"
              }

              function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
                  var output = [];
                  for (var i = 0, l = value.length; i < l; ++i) {
                      if (hasOwnProperty(value, String(i))) {
                          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true))
                      } else {
                          output.push("")
                      }
                  }
                  keys.forEach(function (key) {
                      if (!key.match(/^\d+$/)) {
                          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true))
                      }
                  });
                  return output
              }

              function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
                  var name, str, desc;
                  desc = Object.getOwnPropertyDescriptor(value, key) || {
                      value: value[key]
                  };
                  if (desc.get) {
                      if (desc.set) {
                          str = ctx.stylize("[Getter/Setter]", "special")
                      } else {
                          str = ctx.stylize("[Getter]", "special")
                      }
                  } else {
                      if (desc.set) {
                          str = ctx.stylize("[Setter]", "special")
                      }
                  }
                  if (!hasOwnProperty(visibleKeys, key)) {
                      name = "[" + key + "]"
                  }
                  if (!str) {
                      if (ctx.seen.indexOf(desc.value) < 0) {
                          if (isNull(recurseTimes)) {
                              str = formatValue(ctx, desc.value, null)
                          } else {
                              str = formatValue(ctx, desc.value, recurseTimes - 1)
                          }
                          if (str.indexOf("\n") > -1) {
                              if (array) {
                                  str = str.split("\n").map(function (line) {
                                      return "  " + line
                                  }).join("\n").substr(2)
                              } else {
                                  str = "\n" + str.split("\n").map(function (line) {
                                      return "   " + line
                                  }).join("\n")
                              }
                          }
                      } else {
                          str = ctx.stylize("[Circular]", "special")
                      }
                  }
                  if (isUndefined(name)) {
                      if (array && key.match(/^\d+$/)) {
                          return str
                      }
                      name = JSON.stringify("" + key);
                      if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                          name = name.substr(1, name.length - 2);
                          name = ctx.stylize(name, "name")
                      } else {
                          name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
                          name = ctx.stylize(name, "string")
                      }
                  }
                  return name + ": " + str
              }

              function reduceToSingleString(output, base, braces) {
                  var numLinesEst = 0;
                  var length = output.reduce(function (prev, cur) {
                      numLinesEst++;
                      if (cur.indexOf("\n") >= 0) numLinesEst++;
                      return prev + cur.replace(/\u001b\[\d\d?m/g, "").length + 1
                  }, 0);
                  if (length > 60) {
                      return braces[0] + (base === "" ? "" : base + "\n ") + " " + output.join(",\n  ") + " " + braces[1]
                  }
                  return braces[0] + base + " " + output.join(", ") + " " + braces[1]
              }

              function isArray(ar) {
                  return Array.isArray(ar)
              }
              exports.isArray = isArray;

              function isBoolean(arg) {
                  return typeof arg === "boolean"
              }
              exports.isBoolean = isBoolean;

              function isNull(arg) {
                  return arg === null
              }
              exports.isNull = isNull;

              function isNullOrUndefined(arg) {
                  return arg == null
              }
              exports.isNullOrUndefined = isNullOrUndefined;

              function isNumber(arg) {
                  return typeof arg === "number"
              }
              exports.isNumber = isNumber;

              function isString(arg) {
                  return typeof arg === "string"
              }
              exports.isString = isString;

              function isSymbol(arg) {
                  return typeof arg === "symbol"
              }
              exports.isSymbol = isSymbol;

              function isUndefined(arg) {
                  return arg === void 0
              }
              exports.isUndefined = isUndefined;

              function isRegExp(re) {
                  return isObject(re) && objectToString(re) === "[object RegExp]"
              }
              exports.isRegExp = isRegExp;

              function isObject(arg) {
                  return typeof arg === "object" && arg !== null
              }
              exports.isObject = isObject;

              function isDate(d) {
                  return isObject(d) && objectToString(d) === "[object Date]"
              }
              exports.isDate = isDate;

              function isError(e) {
                  return isObject(e) && (objectToString(e) === "[object Error]" || e instanceof Error)
              }
              exports.isError = isError;

              function isFunction(arg) {
                  return typeof arg === "function"
              }
              exports.isFunction = isFunction;

              function isPrimitive(arg) {
                  return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || typeof arg === "undefined"
              }
              exports.isPrimitive = isPrimitive;
              exports.isBuffer = require("./support/isBuffer");

              function objectToString(o) {
                  return Object.prototype.toString.call(o)
              }

              function pad(n) {
                  return n < 10 ? "0" + n.toString(10) : n.toString(10)
              }
              var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

              function timestamp() {
                  var d = new Date;
                  var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(":");
                  return [d.getDate(), months[d.getMonth()], time].join(" ")
              }
              exports.log = function () {
                  console.log("%s - %s", timestamp(), exports.format.apply(exports, arguments))
              };
              exports.inherits = require("inherits");
              exports._extend = function (origin, add) {
                  if (!add || !isObject(add)) return origin;
                  var keys = Object.keys(add);
                  var i = keys.length;
                  while (i--) {
                      origin[keys[i]] = add[keys[i]]
                  }
                  return origin
              };

              function hasOwnProperty(obj, prop) {
                  return Object.prototype.hasOwnProperty.call(obj, prop)
              }
          }).call(this)
      }).call(this, require("_process"), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  }, {
      "./support/isBuffer": 9,
      _process: 36,
      inherits: 8
  }],
  11: [function (require, module, exports) {
      (function (global) {
          (function () {
              "use strict";
              var possibleNames = ["BigInt64Array", "BigUint64Array", "Float32Array", "Float64Array", "Int16Array", "Int32Array", "Int8Array", "Uint16Array", "Uint32Array", "Uint8Array", "Uint8ClampedArray"];
              var g = typeof globalThis === "undefined" ? global : globalThis;
              module.exports = function availableTypedArrays() {
                  var out = [];
                  for (var i = 0; i < possibleNames.length; i++) {
                      if (typeof g[possibleNames[i]] === "function") {
                          out[out.length] = possibleNames[i]
                      }
                  }
                  return out
              }
          }).call(this)
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  }, {}],
  12: [function (require, module, exports) {
      "use strict";
      exports.byteLength = byteLength;
      exports.toByteArray = toByteArray;
      exports.fromByteArray = fromByteArray;
      var lookup = [];
      var revLookup = [];
      var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
      var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (var i = 0, len = code.length; i < len; ++i) {
          lookup[i] = code[i];
          revLookup[code.charCodeAt(i)] = i
      }
      revLookup["-".charCodeAt(0)] = 62;
      revLookup["_".charCodeAt(0)] = 63;

      function getLens(b64) {
          var len = b64.length;
          if (len % 4 > 0) {
              throw new Error("Invalid string. Length must be a multiple of 4")
          }
          var validLen = b64.indexOf("=");
          if (validLen === -1) validLen = len;
          var placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
          return [validLen, placeHoldersLen]
      }

      function byteLength(b64) {
          var lens = getLens(b64);
          var validLen = lens[0];
          var placeHoldersLen = lens[1];
          return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen
      }

      function _byteLength(b64, validLen, placeHoldersLen) {
          return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen
      }

      function toByteArray(b64) {
          var tmp;
          var lens = getLens(b64);
          var validLen = lens[0];
          var placeHoldersLen = lens[1];
          var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
          var curByte = 0;
          var len = placeHoldersLen > 0 ? validLen - 4 : validLen;
          var i;
          for (i = 0; i < len; i += 4) {
              tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
              arr[curByte++] = tmp >> 16 & 255;
              arr[curByte++] = tmp >> 8 & 255;
              arr[curByte++] = tmp & 255
          }
          if (placeHoldersLen === 2) {
              tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
              arr[curByte++] = tmp & 255
          }
          if (placeHoldersLen === 1) {
              tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
              arr[curByte++] = tmp >> 8 & 255;
              arr[curByte++] = tmp & 255
          }
          return arr
      }

      function tripletToBase64(num) {
          return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63]
      }

      function encodeChunk(uint8, start, end) {
          var tmp;
          var output = [];
          for (var i = start; i < end; i += 3) {
              tmp = (uint8[i] << 16 & 16711680) + (uint8[i + 1] << 8 & 65280) + (uint8[i + 2] & 255);
              output.push(tripletToBase64(tmp))
          }
          return output.join("")
      }

      function fromByteArray(uint8) {
          var tmp;
          var len = uint8.length;
          var extraBytes = len % 3;
          var parts = [];
          var maxChunkLength = 16383;
          for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
              parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength))
          }
          if (extraBytes === 1) {
              tmp = uint8[len - 1];
              parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==")
          } else if (extraBytes === 2) {
              tmp = (uint8[len - 2] << 8) + uint8[len - 1];
              parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=")
          }
          return parts.join("")
      }
  }, {}],
  13: [function (require, module, exports) {
      "use strict";
      const {
          Buffer: Buffer
      } = require("buffer");
      const symbol = Symbol.for("BufferList");

      function BufferList(buf) {
          if (!(this instanceof BufferList)) {
              return new BufferList(buf)
          }
          BufferList._init.call(this, buf)
      }
      BufferList._init = function _init(buf) {
          Object.defineProperty(this, symbol, {
              value: true
          });
          this._bufs = [];
          this.length = 0;
          if (buf) {
              this.append(buf)
          }
      };
      BufferList.prototype._new = function _new(buf) {
          return new BufferList(buf)
      };
      BufferList.prototype._offset = function _offset(offset) {
          if (offset === 0) {
              return [0, 0]
          }
          let tot = 0;
          for (let i = 0; i < this._bufs.length; i++) {
              const _t = tot + this._bufs[i].length;
              if (offset < _t || i === this._bufs.length - 1) {
                  return [i, offset - tot]
              }
              tot = _t
          }
      };
      BufferList.prototype._reverseOffset = function (blOffset) {
          const bufferId = blOffset[0];
          let offset = blOffset[1];
          for (let i = 0; i < bufferId; i++) {
              offset += this._bufs[i].length
          }
          return offset
      };
      BufferList.prototype.get = function get(index) {
          if (index > this.length || index < 0) {
              return undefined
          }
          const offset = this._offset(index);
          return this._bufs[offset[0]][offset[1]]
      };
      BufferList.prototype.slice = function slice(start, end) {
          if (typeof start === "number" && start < 0) {
              start += this.length
          }
          if (typeof end === "number" && end < 0) {
              end += this.length
          }
          return this.copy(null, 0, start, end)
      };
      BufferList.prototype.copy = function copy(dst, dstStart, srcStart, srcEnd) {
          if (typeof srcStart !== "number" || srcStart < 0) {
              srcStart = 0
          }
          if (typeof srcEnd !== "number" || srcEnd > this.length) {
              srcEnd = this.length
          }
          if (srcStart >= this.length) {
              return dst || Buffer.alloc(0)
          }
          if (srcEnd <= 0) {
              return dst || Buffer.alloc(0)
          }
          const copy = !!dst;
          const off = this._offset(srcStart);
          const len = srcEnd - srcStart;
          let bytes = len;
          let bufoff = copy && dstStart || 0;
          let start = off[1];
          if (srcStart === 0 && srcEnd === this.length) {
              if (!copy) {
                  return this._bufs.length === 1 ? this._bufs[0] : Buffer.concat(this._bufs, this.length)
              }
              for (let i = 0; i < this._bufs.length; i++) {
                  this._bufs[i].copy(dst, bufoff);
                  bufoff += this._bufs[i].length
              }
              return dst
          }
          if (bytes <= this._bufs[off[0]].length - start) {
              return copy ? this._bufs[off[0]].copy(dst, dstStart, start, start + bytes) : this._bufs[off[0]].slice(start, start + bytes)
          }
          if (!copy) {
              dst = Buffer.allocUnsafe(len)
          }
          for (let i = off[0]; i < this._bufs.length; i++) {
              const l = this._bufs[i].length - start;
              if (bytes > l) {
                  this._bufs[i].copy(dst, bufoff, start);
                  bufoff += l
              } else {
                  this._bufs[i].copy(dst, bufoff, start, start + bytes);
                  bufoff += l;
                  break
              }
              bytes -= l;
              if (start) {
                  start = 0
              }
          }
          if (dst.length > bufoff) return dst.slice(0, bufoff);
          return dst
      };
      BufferList.prototype.shallowSlice = function shallowSlice(start, end) {
          start = start || 0;
          end = typeof end !== "number" ? this.length : end;
          if (start < 0) {
              start += this.length
          }
          if (end < 0) {
              end += this.length
          }
          if (start === end) {
              return this._new()
          }
          const startOffset = this._offset(start);
          const endOffset = this._offset(end);
          const buffers = this._bufs.slice(startOffset[0], endOffset[0] + 1);
          if (endOffset[1] === 0) {
              buffers.pop()
          } else {
              buffers[buffers.length - 1] = buffers[buffers.length - 1].slice(0, endOffset[1])
          }
          if (startOffset[1] !== 0) {
              buffers[0] = buffers[0].slice(startOffset[1])
          }
          return this._new(buffers)
      };
      BufferList.prototype.toString = function toString(encoding, start, end) {
          return this.slice(start, end).toString(encoding)
      };
      BufferList.prototype.consume = function consume(bytes) {
          bytes = Math.trunc(bytes);
          if (Number.isNaN(bytes) || bytes <= 0) return this;
          while (this._bufs.length) {
              if (bytes >= this._bufs[0].length) {
                  bytes -= this._bufs[0].length;
                  this.length -= this._bufs[0].length;
                  this._bufs.shift()
              } else {
                  this._bufs[0] = this._bufs[0].slice(bytes);
                  this.length -= bytes;
                  break
              }
          }
          return this
      };
      BufferList.prototype.duplicate = function duplicate() {
          const copy = this._new();
          for (let i = 0; i < this._bufs.length; i++) {
              copy.append(this._bufs[i])
          }
          return copy
      };
      BufferList.prototype.append = function append(buf) {
          if (buf == null) {
              return this
          }
          if (buf.buffer) {
              this._appendBuffer(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength))
          } else if (Array.isArray(buf)) {
              for (let i = 0; i < buf.length; i++) {
                  this.append(buf[i])
              }
          } else if (this._isBufferList(buf)) {
              for (let i = 0; i < buf._bufs.length; i++) {
                  this.append(buf._bufs[i])
              }
          } else {
              if (typeof buf === "number") {
                  buf = buf.toString()
              }
              this._appendBuffer(Buffer.from(buf))
          }
          return this
      };
      BufferList.prototype._appendBuffer = function appendBuffer(buf) {
          this._bufs.push(buf);
          this.length += buf.length
      };
      BufferList.prototype.indexOf = function (search, offset, encoding) {
          if (encoding === undefined && typeof offset === "string") {
              encoding = offset;
              offset = undefined
          }
          if (typeof search === "function" || Array.isArray(search)) {
              throw new TypeError('The "value" argument must be one of type string, Buffer, BufferList, or Uint8Array.')
          } else if (typeof search === "number") {
              search = Buffer.from([search])
          } else if (typeof search === "string") {
              search = Buffer.from(search, encoding)
          } else if (this._isBufferList(search)) {
              search = search.slice()
          } else if (Array.isArray(search.buffer)) {
              search = Buffer.from(search.buffer, search.byteOffset, search.byteLength)
          } else if (!Buffer.isBuffer(search)) {
              search = Buffer.from(search)
          }
          offset = Number(offset || 0);
          if (isNaN(offset)) {
              offset = 0
          }
          if (offset < 0) {
              offset = this.length + offset
          }
          if (offset < 0) {
              offset = 0
          }
          if (search.length === 0) {
              return offset > this.length ? this.length : offset
          }
          const blOffset = this._offset(offset);
          let blIndex = blOffset[0];
          let buffOffset = blOffset[1];
          for (; blIndex < this._bufs.length; blIndex++) {
              const buff = this._bufs[blIndex];
              while (buffOffset < buff.length) {
                  const availableWindow = buff.length - buffOffset;
                  if (availableWindow >= search.length) {
                      const nativeSearchResult = buff.indexOf(search, buffOffset);
                      if (nativeSearchResult !== -1) {
                          return this._reverseOffset([blIndex, nativeSearchResult])
                      }
                      buffOffset = buff.length - search.length + 1
                  } else {
                      const revOffset = this._reverseOffset([blIndex, buffOffset]);
                      if (this._match(revOffset, search)) {
                          return revOffset
                      }
                      buffOffset++
                  }
              }
              buffOffset = 0
          }
          return -1
      };
      BufferList.prototype._match = function (offset, search) {
          if (this.length - offset < search.length) {
              return false
          }
          for (let searchOffset = 0; searchOffset < search.length; searchOffset++) {
              if (this.get(offset + searchOffset) !== search[searchOffset]) {
                  return false
              }
          }
          return true
      };
      (function () {
          const methods = {
              readDoubleBE: 8,
              readDoubleLE: 8,
              readFloatBE: 4,
              readFloatLE: 4,
              readInt32BE: 4,
              readInt32LE: 4,
              readUInt32BE: 4,
              readUInt32LE: 4,
              readInt16BE: 2,
              readInt16LE: 2,
              readUInt16BE: 2,
              readUInt16LE: 2,
              readInt8: 1,
              readUInt8: 1,
              readIntBE: null,
              readIntLE: null,
              readUIntBE: null,
              readUIntLE: null
          };
          for (const m in methods) {
              (function (m) {
                  if (methods[m] === null) {
                      BufferList.prototype[m] = function (offset, byteLength) {
                          return this.slice(offset, offset + byteLength)[m](0, byteLength)
                      }
                  } else {
                      BufferList.prototype[m] = function (offset = 0) {
                          return this.slice(offset, offset + methods[m])[m](0)
                      }
                  }
              })(m)
          }
      })();
      BufferList.prototype._isBufferList = function _isBufferList(b) {
          return b instanceof BufferList || BufferList.isBufferList(b)
      };
      BufferList.isBufferList = function isBufferList(b) {
          return b != null && b[symbol]
      };
      module.exports = BufferList
  }, {
      buffer: 16
  }],
  14: [function (require, module, exports) {
      "use strict";
      const DuplexStream = require("readable-stream").Duplex;
      const inherits = require("inherits");
      const BufferList = require("./BufferList");

      function BufferListStream(callback) {
          if (!(this instanceof BufferListStream)) {
              return new BufferListStream(callback)
          }
          if (typeof callback === "function") {
              this._callback = callback;
              const piper = function piper(err) {
                  if (this._callback) {
                      this._callback(err);
                      this._callback = null
                  }
              }.bind(this);
              this.on("pipe", function onPipe(src) {
                  src.on("error", piper)
              });
              this.on("unpipe", function onUnpipe(src) {
                  src.removeListener("error", piper)
              });
              callback = null
          }
          BufferList._init.call(this, callback);
          DuplexStream.call(this)
      }
      inherits(BufferListStream, DuplexStream);
      Object.assign(BufferListStream.prototype, BufferList.prototype);
      BufferListStream.prototype._new = function _new(callback) {
          return new BufferListStream(callback)
      };
      BufferListStream.prototype._write = function _write(buf, encoding, callback) {
          this._appendBuffer(buf);
          if (typeof callback === "function") {
              callback()
          }
      };
      BufferListStream.prototype._read = function _read(size) {
          if (!this.length) {
              return this.push(null)
          }
          size = Math.min(size, this.length);
          this.push(this.slice(0, size));
          this.consume(size)
      };
      BufferListStream.prototype.end = function end(chunk) {
          DuplexStream.prototype.end.call(this, chunk);
          if (this._callback) {
              this._callback(null, this.slice());
              this._callback = null
          }
      };
      BufferListStream.prototype._destroy = function _destroy(err, cb) {
          this._bufs.length = 0;
          this.length = 0;
          cb(err)
      };
      BufferListStream.prototype._isBufferList = function _isBufferList(b) {
          return b instanceof BufferListStream || b instanceof BufferList || BufferListStream.isBufferList(b)
      };
      BufferListStream.isBufferList = BufferList.isBufferList;
      module.exports = BufferListStream;
      module.exports.BufferListStream = BufferListStream;
      module.exports.BufferList = BufferList
  }, {
      "./BufferList": 13,
      inherits: 30,
      "readable-stream": 51
  }],
  15: [function (require, module, exports) {}, {}],
  16: [function (require, module, exports) {
      (function (Buffer) {
          (function () {
              "use strict";
              var base64 = require("base64-js");
              var ieee754 = require("ieee754");
              exports.Buffer = Buffer;
              exports.SlowBuffer = SlowBuffer;
              exports.INSPECT_MAX_BYTES = 50;
              var K_MAX_LENGTH = 2147483647;
              exports.kMaxLength = K_MAX_LENGTH;
              Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();
              if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
                  console.error("This browser lacks typed array (Uint8Array) support which is required by " + "`buffer` v5.x. Use `buffer` v4.x if you require old browser support.")
              }

              function typedArraySupport() {
                  try {
                      var arr = new Uint8Array(1);
                      arr.__proto__ = {
                          __proto__: Uint8Array.prototype,
                          foo: function () {
                              return 42
                          }
                      };
                      return arr.foo() === 42
                  } catch (e) {
                      return false
                  }
              }
              Object.defineProperty(Buffer.prototype, "parent", {
                  enumerable: true,
                  get: function () {
                      if (!Buffer.isBuffer(this)) return undefined;
                      return this.buffer
                  }
              });
              Object.defineProperty(Buffer.prototype, "offset", {
                  enumerable: true,
                  get: function () {
                      if (!Buffer.isBuffer(this)) return undefined;
                      return this.byteOffset
                  }
              });

              function createBuffer(length) {
                  if (length > K_MAX_LENGTH) {
                      throw new RangeError('The value "' + length + '" is invalid for option "size"')
                  }
                  var buf = new Uint8Array(length);
                  buf.__proto__ = Buffer.prototype;
                  return buf
              }

              function Buffer(arg, encodingOrOffset, length) {
                  if (typeof arg === "number") {
                      if (typeof encodingOrOffset === "string") {
                          throw new TypeError('The "string" argument must be of type string. Received type number')
                      }
                      return allocUnsafe(arg)
                  }
                  return from(arg, encodingOrOffset, length)
              }
              if (typeof Symbol !== "undefined" && Symbol.species != null && Buffer[Symbol.species] === Buffer) {
                  Object.defineProperty(Buffer, Symbol.species, {
                      value: null,
                      configurable: true,
                      enumerable: false,
                      writable: false
                  })
              }
              Buffer.poolSize = 8192;

              function from(value, encodingOrOffset, length) {
                  if (typeof value === "string") {
                      return fromString(value, encodingOrOffset)
                  }
                  if (ArrayBuffer.isView(value)) {
                      return fromArrayLike(value)
                  }
                  if (value == null) {
                      throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, " + "or Array-like Object. Received type " + typeof value)
                  }
                  if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
                      return fromArrayBuffer(value, encodingOrOffset, length)
                  }
                  if (typeof value === "number") {
                      throw new TypeError('The "value" argument must not be of type number. Received type number')
                  }
                  var valueOf = value.valueOf && value.valueOf();
                  if (valueOf != null && valueOf !== value) {
                      return Buffer.from(valueOf, encodingOrOffset, length)
                  }
                  var b = fromObject(value);
                  if (b) return b;
                  if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
                      return Buffer.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length)
                  }
                  throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, " + "or Array-like Object. Received type " + typeof value)
              }
              Buffer.from = function (value, encodingOrOffset, length) {
                  return from(value, encodingOrOffset, length)
              };
              Buffer.prototype.__proto__ = Uint8Array.prototype;
              Buffer.__proto__ = Uint8Array;

              function assertSize(size) {
                  if (typeof size !== "number") {
                      throw new TypeError('"size" argument must be of type number')
                  } else if (size < 0) {
                      throw new RangeError('The value "' + size + '" is invalid for option "size"')
                  }
              }

              function alloc(size, fill, encoding) {
                  assertSize(size);
                  if (size <= 0) {
                      return createBuffer(size)
                  }
                  if (fill !== undefined) {
                      return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill)
                  }
                  return createBuffer(size)
              }
              Buffer.alloc = function (size, fill, encoding) {
                  return alloc(size, fill, encoding)
              };

              function allocUnsafe(size) {
                  assertSize(size);
                  return createBuffer(size < 0 ? 0 : checked(size) | 0)
              }
              Buffer.allocUnsafe = function (size) {
                  return allocUnsafe(size)
              };
              Buffer.allocUnsafeSlow = function (size) {
                  return allocUnsafe(size)
              };

              function fromString(string, encoding) {
                  if (typeof encoding !== "string" || encoding === "") {
                      encoding = "utf8"
                  }
                  if (!Buffer.isEncoding(encoding)) {
                      throw new TypeError("Unknown encoding: " + encoding)
                  }
                  var length = byteLength(string, encoding) | 0;
                  var buf = createBuffer(length);
                  var actual = buf.write(string, encoding);
                  if (actual !== length) {
                      buf = buf.slice(0, actual)
                  }
                  return buf
              }

              function fromArrayLike(array) {
                  var length = array.length < 0 ? 0 : checked(array.length) | 0;
                  var buf = createBuffer(length);
                  for (var i = 0; i < length; i += 1) {
                      buf[i] = array[i] & 255
                  }
                  return buf
              }

              function fromArrayBuffer(array, byteOffset, length) {
                  if (byteOffset < 0 || array.byteLength < byteOffset) {
                      throw new RangeError('"offset" is outside of buffer bounds')
                  }
                  if (array.byteLength < byteOffset + (length || 0)) {
                      throw new RangeError('"length" is outside of buffer bounds')
                  }
                  var buf;
                  if (byteOffset === undefined && length === undefined) {
                      buf = new Uint8Array(array)
                  } else if (length === undefined) {
                      buf = new Uint8Array(array, byteOffset)
                  } else {
                      buf = new Uint8Array(array, byteOffset, length)
                  }
                  buf.__proto__ = Buffer.prototype;
                  return buf
              }

              function fromObject(obj) {
                  if (Buffer.isBuffer(obj)) {
                      var len = checked(obj.length) | 0;
                      var buf = createBuffer(len);
                      if (buf.length === 0) {
                          return buf
                      }
                      obj.copy(buf, 0, 0, len);
                      return buf
                  }
                  if (obj.length !== undefined) {
                      if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
                          return createBuffer(0)
                      }
                      return fromArrayLike(obj)
                  }
                  if (obj.type === "Buffer" && Array.isArray(obj.data)) {
                      return fromArrayLike(obj.data)
                  }
              }

              function checked(length) {
                  if (length >= K_MAX_LENGTH) {
                      throw new RangeError("Attempt to allocate Buffer larger than maximum " + "size: 0x" + K_MAX_LENGTH.toString(16) + " bytes")
                  }
                  return length | 0
              }

              function SlowBuffer(length) {
                  if (+length != length) {
                      length = 0
                  }
                  return Buffer.alloc(+length)
              }
              Buffer.isBuffer = function isBuffer(b) {
                  return b != null && b._isBuffer === true && b !== Buffer.prototype
              };
              Buffer.compare = function compare(a, b) {
                  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
                  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
                  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
                      throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array')
                  }
                  if (a === b) return 0;
                  var x = a.length;
                  var y = b.length;
                  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
                      if (a[i] !== b[i]) {
                          x = a[i];
                          y = b[i];
                          break
                      }
                  }
                  if (x < y) return -1;
                  if (y < x) return 1;
                  return 0
              };
              Buffer.isEncoding = function isEncoding(encoding) {
                  switch (String(encoding).toLowerCase()) {
                      case "hex":
                      case "utf8":
                      case "utf-8":
                      case "ascii":
                      case "latin1":
                      case "binary":
                      case "base64":
                      case "ucs2":
                      case "ucs-2":
                      case "utf16le":
                      case "utf-16le":
                          return true;
                      default:
                          return false
                  }
              };
              Buffer.concat = function concat(list, length) {
                  if (!Array.isArray(list)) {
                      throw new TypeError('"list" argument must be an Array of Buffers')
                  }
                  if (list.length === 0) {
                      return Buffer.alloc(0)
                  }
                  var i;
                  if (length === undefined) {
                      length = 0;
                      for (i = 0; i < list.length; ++i) {
                          length += list[i].length
                      }
                  }
                  var buffer = Buffer.allocUnsafe(length);
                  var pos = 0;
                  for (i = 0; i < list.length; ++i) {
                      var buf = list[i];
                      if (isInstance(buf, Uint8Array)) {
                          buf = Buffer.from(buf)
                      }
                      if (!Buffer.isBuffer(buf)) {
                          throw new TypeError('"list" argument must be an Array of Buffers')
                      }
                      buf.copy(buffer, pos);
                      pos += buf.length
                  }
                  return buffer
              };

              function byteLength(string, encoding) {
                  if (Buffer.isBuffer(string)) {
                      return string.length
                  }
                  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
                      return string.byteLength
                  }
                  if (typeof string !== "string") {
                      throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' + "Received type " + typeof string)
                  }
                  var len = string.length;
                  var mustMatch = arguments.length > 2 && arguments[2] === true;
                  if (!mustMatch && len === 0) return 0;
                  var loweredCase = false;
                  for (;;) {
                      switch (encoding) {
                          case "ascii":
                          case "latin1":
                          case "binary":
                              return len;
                          case "utf8":
                          case "utf-8":
                              return utf8ToBytes(string).length;
                          case "ucs2":
                          case "ucs-2":
                          case "utf16le":
                          case "utf-16le":
                              return len * 2;
                          case "hex":
                              return len >>> 1;
                          case "base64":
                              return base64ToBytes(string).length;
                          default:
                              if (loweredCase) {
                                  return mustMatch ? -1 : utf8ToBytes(string).length
                              }
                              encoding = ("" + encoding).toLowerCase();
                              loweredCase = true
                      }
                  }
              }
              Buffer.byteLength = byteLength;

              function slowToString(encoding, start, end) {
                  var loweredCase = false;
                  if (start === undefined || start < 0) {
                      start = 0
                  }
                  if (start > this.length) {
                      return ""
                  }
                  if (end === undefined || end > this.length) {
                      end = this.length
                  }
                  if (end <= 0) {
                      return ""
                  }
                  end >>>= 0;
                  start >>>= 0;
                  if (end <= start) {
                      return ""
                  }
                  if (!encoding) encoding = "utf8";
                  while (true) {
                      switch (encoding) {
                          case "hex":
                              return hexSlice(this, start, end);
                          case "utf8":
                          case "utf-8":
                              return utf8Slice(this, start, end);
                          case "ascii":
                              return asciiSlice(this, start, end);
                          case "latin1":
                          case "binary":
                              return latin1Slice(this, start, end);
                          case "base64":
                              return base64Slice(this, start, end);
                          case "ucs2":
                          case "ucs-2":
                          case "utf16le":
                          case "utf-16le":
                              return utf16leSlice(this, start, end);
                          default:
                              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
                              encoding = (encoding + "").toLowerCase();
                              loweredCase = true
                      }
                  }
              }
              Buffer.prototype._isBuffer = true;

              function swap(b, n, m) {
                  var i = b[n];
                  b[n] = b[m];
                  b[m] = i
              }
              Buffer.prototype.swap16 = function swap16() {
                  var len = this.length;
                  if (len % 2 !== 0) {
                      throw new RangeError("Buffer size must be a multiple of 16-bits")
                  }
                  for (var i = 0; i < len; i += 2) {
                      swap(this, i, i + 1)
                  }
                  return this
              };
              Buffer.prototype.swap32 = function swap32() {
                  var len = this.length;
                  if (len % 4 !== 0) {
                      throw new RangeError("Buffer size must be a multiple of 32-bits")
                  }
                  for (var i = 0; i < len; i += 4) {
                      swap(this, i, i + 3);
                      swap(this, i + 1, i + 2)
                  }
                  return this
              };
              Buffer.prototype.swap64 = function swap64() {
                  var len = this.length;
                  if (len % 8 !== 0) {
                      throw new RangeError("Buffer size must be a multiple of 64-bits")
                  }
                  for (var i = 0; i < len; i += 8) {
                      swap(this, i, i + 7);
                      swap(this, i + 1, i + 6);
                      swap(this, i + 2, i + 5);
                      swap(this, i + 3, i + 4)
                  }
                  return this
              };
              Buffer.prototype.toString = function toString() {
                  var length = this.length;
                  if (length === 0) return "";
                  if (arguments.length === 0) return utf8Slice(this, 0, length);
                  return slowToString.apply(this, arguments)
              };
              Buffer.prototype.toLocaleString = Buffer.prototype.toString;
              Buffer.prototype.equals = function equals(b) {
                  if (!Buffer.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
                  if (this === b) return true;
                  return Buffer.compare(this, b) === 0
              };
              Buffer.prototype.inspect = function inspect() {
                  var str = "";
                  var max = exports.INSPECT_MAX_BYTES;
                  str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
                  if (this.length > max) str += " ... ";
                  return "<Buffer " + str + ">"
              };
              Buffer.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
                  if (isInstance(target, Uint8Array)) {
                      target = Buffer.from(target, target.offset, target.byteLength)
                  }
                  if (!Buffer.isBuffer(target)) {
                      throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. ' + "Received type " + typeof target)
                  }
                  if (start === undefined) {
                      start = 0
                  }
                  if (end === undefined) {
                      end = target ? target.length : 0
                  }
                  if (thisStart === undefined) {
                      thisStart = 0
                  }
                  if (thisEnd === undefined) {
                      thisEnd = this.length
                  }
                  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
                      throw new RangeError("out of range index")
                  }
                  if (thisStart >= thisEnd && start >= end) {
                      return 0
                  }
                  if (thisStart >= thisEnd) {
                      return -1
                  }
                  if (start >= end) {
                      return 1
                  }
                  start >>>= 0;
                  end >>>= 0;
                  thisStart >>>= 0;
                  thisEnd >>>= 0;
                  if (this === target) return 0;
                  var x = thisEnd - thisStart;
                  var y = end - start;
                  var len = Math.min(x, y);
                  var thisCopy = this.slice(thisStart, thisEnd);
                  var targetCopy = target.slice(start, end);
                  for (var i = 0; i < len; ++i) {
                      if (thisCopy[i] !== targetCopy[i]) {
                          x = thisCopy[i];
                          y = targetCopy[i];
                          break
                      }
                  }
                  if (x < y) return -1;
                  if (y < x) return 1;
                  return 0
              };

              function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
                  if (buffer.length === 0) return -1;
                  if (typeof byteOffset === "string") {
                      encoding = byteOffset;
                      byteOffset = 0
                  } else if (byteOffset > 2147483647) {
                      byteOffset = 2147483647
                  } else if (byteOffset < -2147483648) {
                      byteOffset = -2147483648
                  }
                  byteOffset = +byteOffset;
                  if (numberIsNaN(byteOffset)) {
                      byteOffset = dir ? 0 : buffer.length - 1
                  }
                  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
                  if (byteOffset >= buffer.length) {
                      if (dir) return -1;
                      else byteOffset = buffer.length - 1
                  } else if (byteOffset < 0) {
                      if (dir) byteOffset = 0;
                      else return -1
                  }
                  if (typeof val === "string") {
                      val = Buffer.from(val, encoding)
                  }
                  if (Buffer.isBuffer(val)) {
                      if (val.length === 0) {
                          return -1
                      }
                      return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
                  } else if (typeof val === "number") {
                      val = val & 255;
                      if (typeof Uint8Array.prototype.indexOf === "function") {
                          if (dir) {
                              return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
                          } else {
                              return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
                          }
                      }
                      return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
                  }
                  throw new TypeError("val must be string, number or Buffer")
              }

              function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
                  var indexSize = 1;
                  var arrLength = arr.length;
                  var valLength = val.length;
                  if (encoding !== undefined) {
                      encoding = String(encoding).toLowerCase();
                      if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
                          if (arr.length < 2 || val.length < 2) {
                              return -1
                          }
                          indexSize = 2;
                          arrLength /= 2;
                          valLength /= 2;
                          byteOffset /= 2
                      }
                  }

                  function read(buf, i) {
                      if (indexSize === 1) {
                          return buf[i]
                      } else {
                          return buf.readUInt16BE(i * indexSize)
                      }
                  }
                  var i;
                  if (dir) {
                      var foundIndex = -1;
                      for (i = byteOffset; i < arrLength; i++) {
                          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                              if (foundIndex === -1) foundIndex = i;
                              if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
                          } else {
                              if (foundIndex !== -1) i -= i - foundIndex;
                              foundIndex = -1
                          }
                      }
                  } else {
                      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
                      for (i = byteOffset; i >= 0; i--) {
                          var found = true;
                          for (var j = 0; j < valLength; j++) {
                              if (read(arr, i + j) !== read(val, j)) {
                                  found = false;
                                  break
                              }
                          }
                          if (found) return i
                      }
                  }
                  return -1
              }
              Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
                  return this.indexOf(val, byteOffset, encoding) !== -1
              };
              Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
                  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
              };
              Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
                  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
              };

              function hexWrite(buf, string, offset, length) {
                  offset = Number(offset) || 0;
                  var remaining = buf.length - offset;
                  if (!length) {
                      length = remaining
                  } else {
                      length = Number(length);
                      if (length > remaining) {
                          length = remaining
                      }
                  }
                  var strLen = string.length;
                  if (length > strLen / 2) {
                      length = strLen / 2
                  }
                  for (var i = 0; i < length; ++i) {
                      var parsed = parseInt(string.substr(i * 2, 2), 16);
                      if (numberIsNaN(parsed)) return i;
                      buf[offset + i] = parsed
                  }
                  return i
              }

              function utf8Write(buf, string, offset, length) {
                  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
              }

              function asciiWrite(buf, string, offset, length) {
                  return blitBuffer(asciiToBytes(string), buf, offset, length)
              }

              function latin1Write(buf, string, offset, length) {
                  return asciiWrite(buf, string, offset, length)
              }

              function base64Write(buf, string, offset, length) {
                  return blitBuffer(base64ToBytes(string), buf, offset, length)
              }

              function ucs2Write(buf, string, offset, length) {
                  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
              }
              Buffer.prototype.write = function write(string, offset, length, encoding) {
                  if (offset === undefined) {
                      encoding = "utf8";
                      length = this.length;
                      offset = 0
                  } else if (length === undefined && typeof offset === "string") {
                      encoding = offset;
                      length = this.length;
                      offset = 0
                  } else if (isFinite(offset)) {
                      offset = offset >>> 0;
                      if (isFinite(length)) {
                          length = length >>> 0;
                          if (encoding === undefined) encoding = "utf8"
                      } else {
                          encoding = length;
                          length = undefined
                      }
                  } else {
                      throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported")
                  }
                  var remaining = this.length - offset;
                  if (length === undefined || length > remaining) length = remaining;
                  if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
                      throw new RangeError("Attempt to write outside buffer bounds")
                  }
                  if (!encoding) encoding = "utf8";
                  var loweredCase = false;
                  for (;;) {
                      switch (encoding) {
                          case "hex":
                              return hexWrite(this, string, offset, length);
                          case "utf8":
                          case "utf-8":
                              return utf8Write(this, string, offset, length);
                          case "ascii":
                              return asciiWrite(this, string, offset, length);
                          case "latin1":
                          case "binary":
                              return latin1Write(this, string, offset, length);
                          case "base64":
                              return base64Write(this, string, offset, length);
                          case "ucs2":
                          case "ucs-2":
                          case "utf16le":
                          case "utf-16le":
                              return ucs2Write(this, string, offset, length);
                          default:
                              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
                              encoding = ("" + encoding).toLowerCase();
                              loweredCase = true
                      }
                  }
              };
              Buffer.prototype.toJSON = function toJSON() {
                  return {
                      type: "Buffer",
                      data: Array.prototype.slice.call(this._arr || this, 0)
                  }
              };

              function base64Slice(buf, start, end) {
                  if (start === 0 && end === buf.length) {
                      return base64.fromByteArray(buf)
                  } else {
                      return base64.fromByteArray(buf.slice(start, end))
                  }
              }

              function utf8Slice(buf, start, end) {
                  end = Math.min(buf.length, end);
                  var res = [];
                  var i = start;
                  while (i < end) {
                      var firstByte = buf[i];
                      var codePoint = null;
                      var bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
                      if (i + bytesPerSequence <= end) {
                          var secondByte, thirdByte, fourthByte, tempCodePoint;
                          switch (bytesPerSequence) {
                              case 1:
                                  if (firstByte < 128) {
                                      codePoint = firstByte
                                  }
                                  break;
                              case 2:
                                  secondByte = buf[i + 1];
                                  if ((secondByte & 192) === 128) {
                                      tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                                      if (tempCodePoint > 127) {
                                          codePoint = tempCodePoint
                                      }
                                  }
                                  break;
                              case 3:
                                  secondByte = buf[i + 1];
                                  thirdByte = buf[i + 2];
                                  if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                                      tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                                      if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                                          codePoint = tempCodePoint
                                      }
                                  }
                                  break;
                              case 4:
                                  secondByte = buf[i + 1];
                                  thirdByte = buf[i + 2];
                                  fourthByte = buf[i + 3];
                                  if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                                      tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                                      if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                                          codePoint = tempCodePoint
                                      }
                                  }
                          }
                      }
                      if (codePoint === null) {
                          codePoint = 65533;
                          bytesPerSequence = 1
                      } else if (codePoint > 65535) {
                          codePoint -= 65536;
                          res.push(codePoint >>> 10 & 1023 | 55296);
                          codePoint = 56320 | codePoint & 1023
                      }
                      res.push(codePoint);
                      i += bytesPerSequence
                  }
                  return decodeCodePointsArray(res)
              }
              var MAX_ARGUMENTS_LENGTH = 4096;

              function decodeCodePointsArray(codePoints) {
                  var len = codePoints.length;
                  if (len <= MAX_ARGUMENTS_LENGTH) {
                      return String.fromCharCode.apply(String, codePoints)
                  }
                  var res = "";
                  var i = 0;
                  while (i < len) {
                      res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH))
                  }
                  return res
              }

              function asciiSlice(buf, start, end) {
                  var ret = "";
                  end = Math.min(buf.length, end);
                  for (var i = start; i < end; ++i) {
                      ret += String.fromCharCode(buf[i] & 127)
                  }
                  return ret
              }

              function latin1Slice(buf, start, end) {
                  var ret = "";
                  end = Math.min(buf.length, end);
                  for (var i = start; i < end; ++i) {
                      ret += String.fromCharCode(buf[i])
                  }
                  return ret
              }

              function hexSlice(buf, start, end) {
                  var len = buf.length;
                  if (!start || start < 0) start = 0;
                  if (!end || end < 0 || end > len) end = len;
                  var out = "";
                  for (var i = start; i < end; ++i) {
                      out += toHex(buf[i])
                  }
                  return out
              }

              function utf16leSlice(buf, start, end) {
                  var bytes = buf.slice(start, end);
                  var res = "";
                  for (var i = 0; i < bytes.length; i += 2) {
                      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
                  }
                  return res
              }
              Buffer.prototype.slice = function slice(start, end) {
                  var len = this.length;
                  start = ~~start;
                  end = end === undefined ? len : ~~end;
                  if (start < 0) {
                      start += len;
                      if (start < 0) start = 0
                  } else if (start > len) {
                      start = len
                  }
                  if (end < 0) {
                      end += len;
                      if (end < 0) end = 0
                  } else if (end > len) {
                      end = len
                  }
                  if (end < start) end = start;
                  var newBuf = this.subarray(start, end);
                  newBuf.__proto__ = Buffer.prototype;
                  return newBuf
              };

              function checkOffset(offset, ext, length) {
                  if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
                  if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length")
              }
              Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
                  offset = offset >>> 0;
                  byteLength = byteLength >>> 0;
                  if (!noAssert) checkOffset(offset, byteLength, this.length);
                  var val = this[offset];
                  var mul = 1;
                  var i = 0;
                  while (++i < byteLength && (mul *= 256)) {
                      val += this[offset + i] * mul
                  }
                  return val
              };
              Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
                  offset = offset >>> 0;
                  byteLength = byteLength >>> 0;
                  if (!noAssert) {
                      checkOffset(offset, byteLength, this.length)
                  }
                  var val = this[offset + --byteLength];
                  var mul = 1;
                  while (byteLength > 0 && (mul *= 256)) {
                      val += this[offset + --byteLength] * mul
                  }
                  return val
              };
              Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 1, this.length);
                  return this[offset]
              };
              Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 2, this.length);
                  return this[offset] | this[offset + 1] << 8
              };
              Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 2, this.length);
                  return this[offset] << 8 | this[offset + 1]
              };
              Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 4, this.length);
                  return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216
              };
              Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 4, this.length);
                  return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3])
              };
              Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
                  offset = offset >>> 0;
                  byteLength = byteLength >>> 0;
                  if (!noAssert) checkOffset(offset, byteLength, this.length);
                  var val = this[offset];
                  var mul = 1;
                  var i = 0;
                  while (++i < byteLength && (mul *= 256)) {
                      val += this[offset + i] * mul
                  }
                  mul *= 128;
                  if (val >= mul) val -= Math.pow(2, 8 * byteLength);
                  return val
              };
              Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
                  offset = offset >>> 0;
                  byteLength = byteLength >>> 0;
                  if (!noAssert) checkOffset(offset, byteLength, this.length);
                  var i = byteLength;
                  var mul = 1;
                  var val = this[offset + --i];
                  while (i > 0 && (mul *= 256)) {
                      val += this[offset + --i] * mul
                  }
                  mul *= 128;
                  if (val >= mul) val -= Math.pow(2, 8 * byteLength);
                  return val
              };
              Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 1, this.length);
                  if (!(this[offset] & 128)) return this[offset];
                  return (255 - this[offset] + 1) * -1
              };
              Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 2, this.length);
                  var val = this[offset] | this[offset + 1] << 8;
                  return val & 32768 ? val | 4294901760 : val
              };
              Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 2, this.length);
                  var val = this[offset + 1] | this[offset] << 8;
                  return val & 32768 ? val | 4294901760 : val
              };
              Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 4, this.length);
                  return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24
              };
              Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 4, this.length);
                  return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]
              };
              Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 4, this.length);
                  return ieee754.read(this, offset, true, 23, 4)
              };
              Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 4, this.length);
                  return ieee754.read(this, offset, false, 23, 4)
              };
              Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 8, this.length);
                  return ieee754.read(this, offset, true, 52, 8)
              };
              Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
                  offset = offset >>> 0;
                  if (!noAssert) checkOffset(offset, 8, this.length);
                  return ieee754.read(this, offset, false, 52, 8)
              };

              function checkInt(buf, value, offset, ext, max, min) {
                  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
                  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
                  if (offset + ext > buf.length) throw new RangeError("Index out of range")
              }
              Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  byteLength = byteLength >>> 0;
                  if (!noAssert) {
                      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                      checkInt(this, value, offset, byteLength, maxBytes, 0)
                  }
                  var mul = 1;
                  var i = 0;
                  this[offset] = value & 255;
                  while (++i < byteLength && (mul *= 256)) {
                      this[offset + i] = value / mul & 255
                  }
                  return offset + byteLength
              };
              Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  byteLength = byteLength >>> 0;
                  if (!noAssert) {
                      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                      checkInt(this, value, offset, byteLength, maxBytes, 0)
                  }
                  var i = byteLength - 1;
                  var mul = 1;
                  this[offset + i] = value & 255;
                  while (--i >= 0 && (mul *= 256)) {
                      this[offset + i] = value / mul & 255
                  }
                  return offset + byteLength
              };
              Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
                  this[offset] = value & 255;
                  return offset + 1
              };
              Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
                  this[offset] = value & 255;
                  this[offset + 1] = value >>> 8;
                  return offset + 2
              };
              Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
                  this[offset] = value >>> 8;
                  this[offset + 1] = value & 255;
                  return offset + 2
              };
              Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
                  this[offset + 3] = value >>> 24;
                  this[offset + 2] = value >>> 16;
                  this[offset + 1] = value >>> 8;
                  this[offset] = value & 255;
                  return offset + 4
              };
              Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
                  this[offset] = value >>> 24;
                  this[offset + 1] = value >>> 16;
                  this[offset + 2] = value >>> 8;
                  this[offset + 3] = value & 255;
                  return offset + 4
              };
              Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) {
                      var limit = Math.pow(2, 8 * byteLength - 1);
                      checkInt(this, value, offset, byteLength, limit - 1, -limit)
                  }
                  var i = 0;
                  var mul = 1;
                  var sub = 0;
                  this[offset] = value & 255;
                  while (++i < byteLength && (mul *= 256)) {
                      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                          sub = 1
                      }
                      this[offset + i] = (value / mul >> 0) - sub & 255
                  }
                  return offset + byteLength
              };
              Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) {
                      var limit = Math.pow(2, 8 * byteLength - 1);
                      checkInt(this, value, offset, byteLength, limit - 1, -limit)
                  }
                  var i = byteLength - 1;
                  var mul = 1;
                  var sub = 0;
                  this[offset + i] = value & 255;
                  while (--i >= 0 && (mul *= 256)) {
                      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                          sub = 1
                      }
                      this[offset + i] = (value / mul >> 0) - sub & 255
                  }
                  return offset + byteLength
              };
              Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
                  if (value < 0) value = 255 + value + 1;
                  this[offset] = value & 255;
                  return offset + 1
              };
              Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
                  this[offset] = value & 255;
                  this[offset + 1] = value >>> 8;
                  return offset + 2
              };
              Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
                  this[offset] = value >>> 8;
                  this[offset + 1] = value & 255;
                  return offset + 2
              };
              Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
                  this[offset] = value & 255;
                  this[offset + 1] = value >>> 8;
                  this[offset + 2] = value >>> 16;
                  this[offset + 3] = value >>> 24;
                  return offset + 4
              };
              Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
                  if (value < 0) value = 4294967295 + value + 1;
                  this[offset] = value >>> 24;
                  this[offset + 1] = value >>> 16;
                  this[offset + 2] = value >>> 8;
                  this[offset + 3] = value & 255;
                  return offset + 4
              };

              function checkIEEE754(buf, value, offset, ext, max, min) {
                  if (offset + ext > buf.length) throw new RangeError("Index out of range");
                  if (offset < 0) throw new RangeError("Index out of range")
              }

              function writeFloat(buf, value, offset, littleEndian, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) {
                      checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22)
                  }
                  ieee754.write(buf, value, offset, littleEndian, 23, 4);
                  return offset + 4
              }
              Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
                  return writeFloat(this, value, offset, true, noAssert)
              };
              Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
                  return writeFloat(this, value, offset, false, noAssert)
              };

              function writeDouble(buf, value, offset, littleEndian, noAssert) {
                  value = +value;
                  offset = offset >>> 0;
                  if (!noAssert) {
                      checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292)
                  }
                  ieee754.write(buf, value, offset, littleEndian, 52, 8);
                  return offset + 8
              }
              Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
                  return writeDouble(this, value, offset, true, noAssert)
              };
              Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
                  return writeDouble(this, value, offset, false, noAssert)
              };
              Buffer.prototype.copy = function copy(target, targetStart, start, end) {
                  if (!Buffer.isBuffer(target)) throw new TypeError("argument should be a Buffer");
                  if (!start) start = 0;
                  if (!end && end !== 0) end = this.length;
                  if (targetStart >= target.length) targetStart = target.length;
                  if (!targetStart) targetStart = 0;
                  if (end > 0 && end < start) end = start;
                  if (end === start) return 0;
                  if (target.length === 0 || this.length === 0) return 0;
                  if (targetStart < 0) {
                      throw new RangeError("targetStart out of bounds")
                  }
                  if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
                  if (end < 0) throw new RangeError("sourceEnd out of bounds");
                  if (end > this.length) end = this.length;
                  if (target.length - targetStart < end - start) {
                      end = target.length - targetStart + start
                  }
                  var len = end - start;
                  if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
                      this.copyWithin(targetStart, start, end)
                  } else if (this === target && start < targetStart && targetStart < end) {
                      for (var i = len - 1; i >= 0; --i) {
                          target[i + targetStart] = this[i + start]
                      }
                  } else {
                      Uint8Array.prototype.set.call(target, this.subarray(start, end), targetStart)
                  }
                  return len
              };
              Buffer.prototype.fill = function fill(val, start, end, encoding) {
                  if (typeof val === "string") {
                      if (typeof start === "string") {
                          encoding = start;
                          start = 0;
                          end = this.length
                      } else if (typeof end === "string") {
                          encoding = end;
                          end = this.length
                      }
                      if (encoding !== undefined && typeof encoding !== "string") {
                          throw new TypeError("encoding must be a string")
                      }
                      if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
                          throw new TypeError("Unknown encoding: " + encoding)
                      }
                      if (val.length === 1) {
                          var code = val.charCodeAt(0);
                          if (encoding === "utf8" && code < 128 || encoding === "latin1") {
                              val = code
                          }
                      }
                  } else if (typeof val === "number") {
                      val = val & 255
                  }
                  if (start < 0 || this.length < start || this.length < end) {
                      throw new RangeError("Out of range index")
                  }
                  if (end <= start) {
                      return this
                  }
                  start = start >>> 0;
                  end = end === undefined ? this.length : end >>> 0;
                  if (!val) val = 0;
                  var i;
                  if (typeof val === "number") {
                      for (i = start; i < end; ++i) {
                          this[i] = val
                      }
                  } else {
                      var bytes = Buffer.isBuffer(val) ? val : Buffer.from(val, encoding);
                      var len = bytes.length;
                      if (len === 0) {
                          throw new TypeError('The value "' + val + '" is invalid for argument "value"')
                      }
                      for (i = 0; i < end - start; ++i) {
                          this[i + start] = bytes[i % len]
                      }
                  }
                  return this
              };
              var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

              function base64clean(str) {
                  str = str.split("=")[0];
                  str = str.trim().replace(INVALID_BASE64_RE, "");
                  if (str.length < 2) return "";
                  while (str.length % 4 !== 0) {
                      str = str + "="
                  }
                  return str
              }

              function toHex(n) {
                  if (n < 16) return "0" + n.toString(16);
                  return n.toString(16)
              }

              function utf8ToBytes(string, units) {
                  units = units || Infinity;
                  var codePoint;
                  var length = string.length;
                  var leadSurrogate = null;
                  var bytes = [];
                  for (var i = 0; i < length; ++i) {
                      codePoint = string.charCodeAt(i);
                      if (codePoint > 55295 && codePoint < 57344) {
                          if (!leadSurrogate) {
                              if (codePoint > 56319) {
                                  if ((units -= 3) > -1) bytes.push(239, 191, 189);
                                  continue
                              } else if (i + 1 === length) {
                                  if ((units -= 3) > -1) bytes.push(239, 191, 189);
                                  continue
                              }
                              leadSurrogate = codePoint;
                              continue
                          }
                          if (codePoint < 56320) {
                              if ((units -= 3) > -1) bytes.push(239, 191, 189);
                              leadSurrogate = codePoint;
                              continue
                          }
                          codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536
                      } else if (leadSurrogate) {
                          if ((units -= 3) > -1) bytes.push(239, 191, 189)
                      }
                      leadSurrogate = null;
                      if (codePoint < 128) {
                          if ((units -= 1) < 0) break;
                          bytes.push(codePoint)
                      } else if (codePoint < 2048) {
                          if ((units -= 2) < 0) break;
                          bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128)
                      } else if (codePoint < 65536) {
                          if ((units -= 3) < 0) break;
                          bytes.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128)
                      } else if (codePoint < 1114112) {
                          if ((units -= 4) < 0) break;
                          bytes.push(codePoint >> 18 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128)
                      } else {
                          throw new Error("Invalid code point")
                      }
                  }
                  return bytes
              }

              function asciiToBytes(str) {
                  var byteArray = [];
                  for (var i = 0; i < str.length; ++i) {
                      byteArray.push(str.charCodeAt(i) & 255)
                  }
                  return byteArray
              }

              function utf16leToBytes(str, units) {
                  var c, hi, lo;
                  var byteArray = [];
                  for (var i = 0; i < str.length; ++i) {
                      if ((units -= 2) < 0) break;
                      c = str.charCodeAt(i);
                      hi = c >> 8;
                      lo = c % 256;
                      byteArray.push(lo);
                      byteArray.push(hi)
                  }
                  return byteArray
              }

              function base64ToBytes(str) {
                  return base64.toByteArray(base64clean(str))
              }

              function blitBuffer(src, dst, offset, length) {
                  for (var i = 0; i < length; ++i) {
                      if (i + offset >= dst.length || i >= src.length) break;
                      dst[i + offset] = src[i]
                  }
                  return i
              }

              function isInstance(obj, type) {
                  return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name
              }

              function numberIsNaN(obj) {
                  return obj !== obj
              }
          }).call(this)
      }).call(this, require("buffer").Buffer)
  }, {
      "base64-js": 12,
      buffer: 16,
      ieee754: 29
  }],
  17: [function (require, module, exports) {
      "use strict";
      var GetIntrinsic = require("get-intrinsic");
      var callBind = require("./");
      var $indexOf = callBind(GetIntrinsic("String.prototype.indexOf"));
      module.exports = function callBoundIntrinsic(name, allowMissing) {
          var intrinsic = GetIntrinsic(name, !!allowMissing);
          if (typeof intrinsic === "function" && $indexOf(name, ".prototype.") > -1) {
              return callBind(intrinsic)
          }
          return intrinsic
      }
  }, {
      "./": 18,
      "get-intrinsic": 24
  }],
  18: [function (require, module, exports) {
      "use strict";
      var bind = require("function-bind");
      var GetIntrinsic = require("get-intrinsic");
      var $apply = GetIntrinsic("%Function.prototype.apply%");
      var $call = GetIntrinsic("%Function.prototype.call%");
      var $reflectApply = GetIntrinsic("%Reflect.apply%", true) || bind.call($call, $apply);
      var $gOPD = GetIntrinsic("%Object.getOwnPropertyDescriptor%", true);
      var $defineProperty = GetIntrinsic("%Object.defineProperty%", true);
      var $max = GetIntrinsic("%Math.max%");
      if ($defineProperty) {
          try {
              $defineProperty({}, "a", {
                  value: 1
              })
          } catch (e) {
              $defineProperty = null
          }
      }
      module.exports = function callBind(originalFunction) {
          var func = $reflectApply(bind, $call, arguments);
          if ($gOPD && $defineProperty) {
              var desc = $gOPD(func, "length");
              if (desc.configurable) {
                  $defineProperty(func, "length", {
                      value: 1 + $max(0, originalFunction.length - (arguments.length - 1))
                  })
              }
          }
          return func
      };
      var applyBind = function applyBind() {
          return $reflectApply(bind, $apply, arguments)
      };
      if ($defineProperty) {
          $defineProperty(module.exports, "apply", {
              value: applyBind
          })
      } else {
          module.exports.apply = applyBind
      }
  }, {
      "function-bind": 23,
      "get-intrinsic": 24
  }],
  19: [function (require, module, exports) {
      "use strict";
      var GetIntrinsic = require("get-intrinsic");
      var $gOPD = GetIntrinsic("%Object.getOwnPropertyDescriptor%", true);
      if ($gOPD) {
          try {
              $gOPD([], "length")
          } catch (e) {
              $gOPD = null
          }
      }
      module.exports = $gOPD
  }, {
      "get-intrinsic": 24
  }],
  20: [function (require, module, exports) {
      "use strict";
      var R = typeof Reflect === "object" ? Reflect : null;
      var ReflectApply = R && typeof R.apply === "function" ? R.apply : function ReflectApply(target, receiver, args) {
          return Function.prototype.apply.call(target, receiver, args)
      };
      var ReflectOwnKeys;
      if (R && typeof R.ownKeys === "function") {
          ReflectOwnKeys = R.ownKeys
      } else if (Object.getOwnPropertySymbols) {
          ReflectOwnKeys = function ReflectOwnKeys(target) {
              return Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target))
          }
      } else {
          ReflectOwnKeys = function ReflectOwnKeys(target) {
              return Object.getOwnPropertyNames(target)
          }
      }

      function ProcessEmitWarning(warning) {
          if (console && console.warn) console.warn(warning)
      }
      var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
          return value !== value
      };

      function EventEmitter() {
          EventEmitter.init.call(this)
      }
      module.exports = EventEmitter;
      module.exports.once = once;
      EventEmitter.EventEmitter = EventEmitter;
      EventEmitter.prototype._events = undefined;
      EventEmitter.prototype._eventsCount = 0;
      EventEmitter.prototype._maxListeners = undefined;
      var defaultMaxListeners = 10;

      function checkListener(listener) {
          if (typeof listener !== "function") {
              throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener)
          }
      }
      Object.defineProperty(EventEmitter, "defaultMaxListeners", {
          enumerable: true,
          get: function () {
              return defaultMaxListeners
          },
          set: function (arg) {
              if (typeof arg !== "number" || arg < 0 || NumberIsNaN(arg)) {
                  throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + ".")
              }
              defaultMaxListeners = arg
          }
      });
      EventEmitter.init = function () {
          if (this._events === undefined || this._events === Object.getPrototypeOf(this)._events) {
              this._events = Object.create(null);
              this._eventsCount = 0
          }
          this._maxListeners = this._maxListeners || undefined
      };
      EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
          if (typeof n !== "number" || n < 0 || NumberIsNaN(n)) {
              throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + ".")
          }
          this._maxListeners = n;
          return this
      };

      function _getMaxListeners(that) {
          if (that._maxListeners === undefined) return EventEmitter.defaultMaxListeners;
          return that._maxListeners
      }
      EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
          return _getMaxListeners(this)
      };
      EventEmitter.prototype.emit = function emit(type) {
          var args = [];
          for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
          var doError = type === "error";
          var events = this._events;
          if (events !== undefined) doError = doError && events.error === undefined;
          else if (!doError) return false;
          if (doError) {
              var er;
              if (args.length > 0) er = args[0];
              if (er instanceof Error) {
                  throw er
              }
              var err = new Error("Unhandled error." + (er ? " (" + er.message + ")" : ""));
              err.context = er;
              throw err
          }
          var handler = events[type];
          if (handler === undefined) return false;
          if (typeof handler === "function") {
              ReflectApply(handler, this, args)
          } else {
              var len = handler.length;
              var listeners = arrayClone(handler, len);
              for (var i = 0; i < len; ++i) ReflectApply(listeners[i], this, args)
          }
          return true
      };

      function _addListener(target, type, listener, prepend) {
          var m;
          var events;
          var existing;
          checkListener(listener);
          events = target._events;
          if (events === undefined) {
              events = target._events = Object.create(null);
              target._eventsCount = 0
          } else {
              if (events.newListener !== undefined) {
                  target.emit("newListener", type, listener.listener ? listener.listener : listener);
                  events = target._events
              }
              existing = events[type]
          }
          if (existing === undefined) {
              existing = events[type] = listener;
              ++target._eventsCount
          } else {
              if (typeof existing === "function") {
                  existing = events[type] = prepend ? [listener, existing] : [existing, listener]
              } else if (prepend) {
                  existing.unshift(listener)
              } else {
                  existing.push(listener)
              }
              m = _getMaxListeners(target);
              if (m > 0 && existing.length > m && !existing.warned) {
                  existing.warned = true;
                  var w = new Error("Possible EventEmitter memory leak detected. " + existing.length + " " + String(type) + " listeners " + "added. Use emitter.setMaxListeners() to " + "increase limit");
                  w.name = "MaxListenersExceededWarning";
                  w.emitter = target;
                  w.type = type;
                  w.count = existing.length;
                  ProcessEmitWarning(w)
              }
          }
          return target
      }
      EventEmitter.prototype.addListener = function addListener(type, listener) {
          return _addListener(this, type, listener, false)
      };
      EventEmitter.prototype.on = EventEmitter.prototype.addListener;
      EventEmitter.prototype.prependListener = function prependListener(type, listener) {
          return _addListener(this, type, listener, true)
      };

      function onceWrapper() {
          if (!this.fired) {
              this.target.removeListener(this.type, this.wrapFn);
              this.fired = true;
              if (arguments.length === 0) return this.listener.call(this.target);
              return this.listener.apply(this.target, arguments)
          }
      }

      function _onceWrap(target, type, listener) {
          var state = {
              fired: false,
              wrapFn: undefined,
              target: target,
              type: type,
              listener: listener
          };
          var wrapped = onceWrapper.bind(state);
          wrapped.listener = listener;
          state.wrapFn = wrapped;
          return wrapped
      }
      EventEmitter.prototype.once = function once(type, listener) {
          checkListener(listener);
          this.on(type, _onceWrap(this, type, listener));
          return this
      };
      EventEmitter.prototype.prependOnceListener = function prependOnceListener(type, listener) {
          checkListener(listener);
          this.prependListener(type, _onceWrap(this, type, listener));
          return this
      };
      EventEmitter.prototype.removeListener = function removeListener(type, listener) {
          var list, events, position, i, originalListener;
          checkListener(listener);
          events = this._events;
          if (events === undefined) return this;
          list = events[type];
          if (list === undefined) return this;
          if (list === listener || list.listener === listener) {
              if (--this._eventsCount === 0) this._events = Object.create(null);
              else {
                  delete events[type];
                  if (events.removeListener) this.emit("removeListener", type, list.listener || listener)
              }
          } else if (typeof list !== "function") {
              position = -1;
              for (i = list.length - 1; i >= 0; i--) {
                  if (list[i] === listener || list[i].listener === listener) {
                      originalListener = list[i].listener;
                      position = i;
                      break
                  }
              }
              if (position < 0) return this;
              if (position === 0) list.shift();
              else {
                  spliceOne(list, position)
              }
              if (list.length === 1) events[type] = list[0];
              if (events.removeListener !== undefined) this.emit("removeListener", type, originalListener || listener)
          }
          return this
      };
      EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
      EventEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
          var listeners, events, i;
          events = this._events;
          if (events === undefined) return this;
          if (events.removeListener === undefined) {
              if (arguments.length === 0) {
                  this._events = Object.create(null);
                  this._eventsCount = 0
              } else if (events[type] !== undefined) {
                  if (--this._eventsCount === 0) this._events = Object.create(null);
                  else delete events[type]
              }
              return this
          }
          if (arguments.length === 0) {
              var keys = Object.keys(events);
              var key;
              for (i = 0; i < keys.length; ++i) {
                  key = keys[i];
                  if (key === "removeListener") continue;
                  this.removeAllListeners(key)
              }
              this.removeAllListeners("removeListener");
              this._events = Object.create(null);
              this._eventsCount = 0;
              return this
          }
          listeners = events[type];
          if (typeof listeners === "function") {
              this.removeListener(type, listeners)
          } else if (listeners !== undefined) {
              for (i = listeners.length - 1; i >= 0; i--) {
                  this.removeListener(type, listeners[i])
              }
          }
          return this
      };

      function _listeners(target, type, unwrap) {
          var events = target._events;
          if (events === undefined) return [];
          var evlistener = events[type];
          if (evlistener === undefined) return [];
          if (typeof evlistener === "function") return unwrap ? [evlistener.listener || evlistener] : [evlistener];
          return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length)
      }
      EventEmitter.prototype.listeners = function listeners(type) {
          return _listeners(this, type, true)
      };
      EventEmitter.prototype.rawListeners = function rawListeners(type) {
          return _listeners(this, type, false)
      };
      EventEmitter.listenerCount = function (emitter, type) {
          if (typeof emitter.listenerCount === "function") {
              return emitter.listenerCount(type)
          } else {
              return listenerCount.call(emitter, type)
          }
      };
      EventEmitter.prototype.listenerCount = listenerCount;

      function listenerCount(type) {
          var events = this._events;
          if (events !== undefined) {
              var evlistener = events[type];
              if (typeof evlistener === "function") {
                  return 1
              } else if (evlistener !== undefined) {
                  return evlistener.length
              }
          }
          return 0
      }
      EventEmitter.prototype.eventNames = function eventNames() {
          return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : []
      };

      function arrayClone(arr, n) {
          var copy = new Array(n);
          for (var i = 0; i < n; ++i) copy[i] = arr[i];
          return copy
      }

      function spliceOne(list, index) {
          for (; index + 1 < list.length; index++) list[index] = list[index + 1];
          list.pop()
      }

      function unwrapListeners(arr) {
          var ret = new Array(arr.length);
          for (var i = 0; i < ret.length; ++i) {
              ret[i] = arr[i].listener || arr[i]
          }
          return ret
      }

      function once(emitter, name) {
          return new Promise(function (resolve, reject) {
              function errorListener(err) {
                  emitter.removeListener(name, resolver);
                  reject(err)
              }

              function resolver() {
                  if (typeof emitter.removeListener === "function") {
                      emitter.removeListener("error", errorListener)
                  }
                  resolve([].slice.call(arguments))
              }
              eventTargetAgnosticAddListener(emitter, name, resolver, {
                  once: true
              });
              if (name !== "error") {
                  addErrorHandlerIfEventEmitter(emitter, errorListener, {
                      once: true
                  })
              }
          })
      }

      function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
          if (typeof emitter.on === "function") {
              eventTargetAgnosticAddListener(emitter, "error", handler, flags)
          }
      }

      function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
          if (typeof emitter.on === "function") {
              if (flags.once) {
                  emitter.once(name, listener)
              } else {
                  emitter.on(name, listener)
              }
          } else if (typeof emitter.addEventListener === "function") {
              emitter.addEventListener(name, function wrapListener(arg) {
                  if (flags.once) {
                      emitter.removeEventListener(name, wrapListener)
                  }
                  listener(arg)
              })
          } else {
              throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter)
          }
      }
  }, {}],
  21: [function (require, module, exports) {
      "use strict";
      var isCallable = require("is-callable");
      var toStr = Object.prototype.toString;
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var forEachArray = function forEachArray(array, iterator, receiver) {
          for (var i = 0, len = array.length; i < len; i++) {
              if (hasOwnProperty.call(array, i)) {
                  if (receiver == null) {
                      iterator(array[i], i, array)
                  } else {
                      iterator.call(receiver, array[i], i, array)
                  }
              }
          }
      };
      var forEachString = function forEachString(string, iterator, receiver) {
          for (var i = 0, len = string.length; i < len; i++) {
              if (receiver == null) {
                  iterator(string.charAt(i), i, string)
              } else {
                  iterator.call(receiver, string.charAt(i), i, string)
              }
          }
      };
      var forEachObject = function forEachObject(object, iterator, receiver) {
          for (var k in object) {
              if (hasOwnProperty.call(object, k)) {
                  if (receiver == null) {
                      iterator(object[k], k, object)
                  } else {
                      iterator.call(receiver, object[k], k, object)
                  }
              }
          }
      };
      var forEach = function forEach(list, iterator, thisArg) {
          if (!isCallable(iterator)) {
              throw new TypeError("iterator must be a function")
          }
          var receiver;
          if (arguments.length >= 3) {
              receiver = thisArg
          }
          if (toStr.call(list) === "[object Array]") {
              forEachArray(list, iterator, receiver)
          } else if (typeof list === "string") {
              forEachString(list, iterator, receiver)
          } else {
              forEachObject(list, iterator, receiver)
          }
      };
      module.exports = forEach
  }, {
      "is-callable": 32
  }],
  22: [function (require, module, exports) {
      "use strict";
      var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
      var slice = Array.prototype.slice;
      var toStr = Object.prototype.toString;
      var funcType = "[object Function]";
      module.exports = function bind(that) {
          var target = this;
          if (typeof target !== "function" || toStr.call(target) !== funcType) {
              throw new TypeError(ERROR_MESSAGE + target)
          }
          var args = slice.call(arguments, 1);
          var bound;
          var binder = function () {
              if (this instanceof bound) {
                  var result = target.apply(this, args.concat(slice.call(arguments)));
                  if (Object(result) === result) {
                      return result
                  }
                  return this
              } else {
                  return target.apply(that, args.concat(slice.call(arguments)))
              }
          };
          var boundLength = Math.max(0, target.length - args.length);
          var boundArgs = [];
          for (var i = 0; i < boundLength; i++) {
              boundArgs.push("$" + i)
          }
          bound = Function("binder", "return function (" + boundArgs.join(",") + "){ return binder.apply(this,arguments); }")(binder);
          if (target.prototype) {
              var Empty = function Empty() {};
              Empty.prototype = target.prototype;
              bound.prototype = new Empty;
              Empty.prototype = null
          }
          return bound
      }
  }, {}],
  23: [function (require, module, exports) {
      "use strict";
      var implementation = require("./implementation");
      module.exports = Function.prototype.bind || implementation
  }, {
      "./implementation": 22
  }],
  24: [function (require, module, exports) {
      "use strict";
      var undefined;
      var $SyntaxError = SyntaxError;
      var $Function = Function;
      var $TypeError = TypeError;
      var getEvalledConstructor = function (expressionSyntax) {
          try {
              return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")()
          } catch (e) {}
      };
      var $gOPD = Object.getOwnPropertyDescriptor;
      if ($gOPD) {
          try {
              $gOPD({}, "")
          } catch (e) {
              $gOPD = null
          }
      }
      var throwTypeError = function () {
          throw new $TypeError
      };
      var ThrowTypeError = $gOPD ? function () {
          try {
              arguments.callee;
              return throwTypeError
          } catch (calleeThrows) {
              try {
                  return $gOPD(arguments, "callee").get
              } catch (gOPDthrows) {
                  return throwTypeError
              }
          }
      }() : throwTypeError;
      var hasSymbols = require("has-symbols")();
      var getProto = Object.getPrototypeOf || function (x) {
          return x.__proto__
      };
      var needsEval = {};
      var TypedArray = typeof Uint8Array === "undefined" ? undefined : getProto(Uint8Array);
      var INTRINSICS = {
          "%AggregateError%": typeof AggregateError === "undefined" ? undefined : AggregateError,
          "%Array%": Array,
          "%ArrayBuffer%": typeof ArrayBuffer === "undefined" ? undefined : ArrayBuffer,
          "%ArrayIteratorPrototype%": hasSymbols ? getProto([][Symbol.iterator]()) : undefined,
          "%AsyncFromSyncIteratorPrototype%": undefined,
          "%AsyncFunction%": needsEval,
          "%AsyncGenerator%": needsEval,
          "%AsyncGeneratorFunction%": needsEval,
          "%AsyncIteratorPrototype%": needsEval,
          "%Atomics%": typeof Atomics === "undefined" ? undefined : Atomics,
          "%BigInt%": typeof BigInt === "undefined" ? undefined : BigInt,
          "%Boolean%": Boolean,
          "%DataView%": typeof DataView === "undefined" ? undefined : DataView,
          "%Date%": Date,
          "%decodeURI%": decodeURI,
          "%decodeURIComponent%": decodeURIComponent,
          "%encodeURI%": encodeURI,
          "%encodeURIComponent%": encodeURIComponent,
          "%Error%": Error,
          "%eval%": eval,
          "%EvalError%": EvalError,
          "%Float32Array%": typeof Float32Array === "undefined" ? undefined : Float32Array,
          "%Float64Array%": typeof Float64Array === "undefined" ? undefined : Float64Array,
          "%FinalizationRegistry%": typeof FinalizationRegistry === "undefined" ? undefined : FinalizationRegistry,
          "%Function%": $Function,
          "%GeneratorFunction%": needsEval,
          "%Int8Array%": typeof Int8Array === "undefined" ? undefined : Int8Array,
          "%Int16Array%": typeof Int16Array === "undefined" ? undefined : Int16Array,
          "%Int32Array%": typeof Int32Array === "undefined" ? undefined : Int32Array,
          "%isFinite%": isFinite,
          "%isNaN%": isNaN,
          "%IteratorPrototype%": hasSymbols ? getProto(getProto([][Symbol.iterator]())) : undefined,
          "%JSON%": typeof JSON === "object" ? JSON : undefined,
          "%Map%": typeof Map === "undefined" ? undefined : Map,
          "%MapIteratorPrototype%": typeof Map === "undefined" || !hasSymbols ? undefined : getProto((new Map)[Symbol.iterator]()),
          "%Math%": Math,
          "%Number%": Number,
          "%Object%": Object,
          "%parseFloat%": parseFloat,
          "%parseInt%": parseInt,
          "%Promise%": typeof Promise === "undefined" ? undefined : Promise,
          "%Proxy%": typeof Proxy === "undefined" ? undefined : Proxy,
          "%RangeError%": RangeError,
          "%ReferenceError%": ReferenceError,
          "%Reflect%": typeof Reflect === "undefined" ? undefined : Reflect,
          "%RegExp%": RegExp,
          "%Set%": typeof Set === "undefined" ? undefined : Set,
          "%SetIteratorPrototype%": typeof Set === "undefined" || !hasSymbols ? undefined : getProto((new Set)[Symbol.iterator]()),
          "%SharedArrayBuffer%": typeof SharedArrayBuffer === "undefined" ? undefined : SharedArrayBuffer,
          "%String%": String,
          "%StringIteratorPrototype%": hasSymbols ? getProto("" [Symbol.iterator]()) : undefined,
          "%Symbol%": hasSymbols ? Symbol : undefined,
          "%SyntaxError%": $SyntaxError,
          "%ThrowTypeError%": ThrowTypeError,
          "%TypedArray%": TypedArray,
          "%TypeError%": $TypeError,
          "%Uint8Array%": typeof Uint8Array === "undefined" ? undefined : Uint8Array,
          "%Uint8ClampedArray%": typeof Uint8ClampedArray === "undefined" ? undefined : Uint8ClampedArray,
          "%Uint16Array%": typeof Uint16Array === "undefined" ? undefined : Uint16Array,
          "%Uint32Array%": typeof Uint32Array === "undefined" ? undefined : Uint32Array,
          "%URIError%": URIError,
          "%WeakMap%": typeof WeakMap === "undefined" ? undefined : WeakMap,
          "%WeakRef%": typeof WeakRef === "undefined" ? undefined : WeakRef,
          "%WeakSet%": typeof WeakSet === "undefined" ? undefined : WeakSet
      };
      var doEval = function doEval(name) {
          var value;
          if (name === "%AsyncFunction%") {
              value = getEvalledConstructor("async function () {}")
          } else if (name === "%GeneratorFunction%") {
              value = getEvalledConstructor("function* () {}")
          } else if (name === "%AsyncGeneratorFunction%") {
              value = getEvalledConstructor("async function* () {}")
          } else if (name === "%AsyncGenerator%") {
              var fn = doEval("%AsyncGeneratorFunction%");
              if (fn) {
                  value = fn.prototype
              }
          } else if (name === "%AsyncIteratorPrototype%") {
              var gen = doEval("%AsyncGenerator%");
              if (gen) {
                  value = getProto(gen.prototype)
              }
          }
          INTRINSICS[name] = value;
          return value
      };
      var LEGACY_ALIASES = {
          "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
          "%ArrayPrototype%": ["Array", "prototype"],
          "%ArrayProto_entries%": ["Array", "prototype", "entries"],
          "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
          "%ArrayProto_keys%": ["Array", "prototype", "keys"],
          "%ArrayProto_values%": ["Array", "prototype", "values"],
          "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
          "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
          "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
          "%BooleanPrototype%": ["Boolean", "prototype"],
          "%DataViewPrototype%": ["DataView", "prototype"],
          "%DatePrototype%": ["Date", "prototype"],
          "%ErrorPrototype%": ["Error", "prototype"],
          "%EvalErrorPrototype%": ["EvalError", "prototype"],
          "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
          "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
          "%FunctionPrototype%": ["Function", "prototype"],
          "%Generator%": ["GeneratorFunction", "prototype"],
          "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
          "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
          "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
          "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
          "%JSONParse%": ["JSON", "parse"],
          "%JSONStringify%": ["JSON", "stringify"],
          "%MapPrototype%": ["Map", "prototype"],
          "%NumberPrototype%": ["Number", "prototype"],
          "%ObjectPrototype%": ["Object", "prototype"],
          "%ObjProto_toString%": ["Object", "prototype", "toString"],
          "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
          "%PromisePrototype%": ["Promise", "prototype"],
          "%PromiseProto_then%": ["Promise", "prototype", "then"],
          "%Promise_all%": ["Promise", "all"],
          "%Promise_reject%": ["Promise", "reject"],
          "%Promise_resolve%": ["Promise", "resolve"],
          "%RangeErrorPrototype%": ["RangeError", "prototype"],
          "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
          "%RegExpPrototype%": ["RegExp", "prototype"],
          "%SetPrototype%": ["Set", "prototype"],
          "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
          "%StringPrototype%": ["String", "prototype"],
          "%SymbolPrototype%": ["Symbol", "prototype"],
          "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
          "%TypedArrayPrototype%": ["TypedArray", "prototype"],
          "%TypeErrorPrototype%": ["TypeError", "prototype"],
          "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
          "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
          "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
          "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
          "%URIErrorPrototype%": ["URIError", "prototype"],
          "%WeakMapPrototype%": ["WeakMap", "prototype"],
          "%WeakSetPrototype%": ["WeakSet", "prototype"]
      };
      var bind = require("function-bind");
      var hasOwn = require("has");
      var $concat = bind.call(Function.call, Array.prototype.concat);
      var $spliceApply = bind.call(Function.apply, Array.prototype.splice);
      var $replace = bind.call(Function.call, String.prototype.replace);
      var $strSlice = bind.call(Function.call, String.prototype.slice);
      var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
      var reEscapeChar = /\\(\\)?/g;
      var stringToPath = function stringToPath(string) {
          var first = $strSlice(string, 0, 1);
          var last = $strSlice(string, -1);
          if (first === "%" && last !== "%") {
              throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`")
          } else if (last === "%" && first !== "%") {
              throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`")
          }
          var result = [];
          $replace(string, rePropName, function (match, number, quote, subString) {
              result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match
          });
          return result
      };
      var getBaseIntrinsic = function getBaseIntrinsic(name, allowMissing) {
          var intrinsicName = name;
          var alias;
          if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
              alias = LEGACY_ALIASES[intrinsicName];
              intrinsicName = "%" + alias[0] + "%"
          }
          if (hasOwn(INTRINSICS, intrinsicName)) {
              var value = INTRINSICS[intrinsicName];
              if (value === needsEval) {
                  value = doEval(intrinsicName)
              }
              if (typeof value === "undefined" && !allowMissing) {
                  throw new $TypeError("intrinsic " + name + " exists, but is not available. Please file an issue!")
              }
              return {
                  alias: alias,
                  name: intrinsicName,
                  value: value
              }
          }
          throw new $SyntaxError("intrinsic " + name + " does not exist!")
      };
      module.exports = function GetIntrinsic(name, allowMissing) {
          if (typeof name !== "string" || name.length === 0) {
              throw new $TypeError("intrinsic name must be a non-empty string")
          }
          if (arguments.length > 1 && typeof allowMissing !== "boolean") {
              throw new $TypeError('"allowMissing" argument must be a boolean')
          }
          var parts = stringToPath(name);
          var intrinsicBaseName = parts.length > 0 ? parts[0] : "";
          var intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing);
          var intrinsicRealName = intrinsic.name;
          var value = intrinsic.value;
          var skipFurtherCaching = false;
          var alias = intrinsic.alias;
          if (alias) {
              intrinsicBaseName = alias[0];
              $spliceApply(parts, $concat([0, 1], alias))
          }
          for (var i = 1, isOwn = true; i < parts.length; i += 1) {
              var part = parts[i];
              var first = $strSlice(part, 0, 1);
              var last = $strSlice(part, -1);
              if ((first === '"' || first === "'" || first === "`" || (last === '"' || last === "'" || last === "`")) && first !== last) {
                  throw new $SyntaxError("property names with quotes must have matching quotes")
              }
              if (part === "constructor" || !isOwn) {
                  skipFurtherCaching = true
              }
              intrinsicBaseName += "." + part;
              intrinsicRealName = "%" + intrinsicBaseName + "%";
              if (hasOwn(INTRINSICS, intrinsicRealName)) {
                  value = INTRINSICS[intrinsicRealName]
              } else if (value != null) {
                  if (!(part in value)) {
                      if (!allowMissing) {
                          throw new $TypeError("base intrinsic for " + name + " exists, but the property is not available.")
                      }
                      return void undefined
                  }
                  if ($gOPD && i + 1 >= parts.length) {
                      var desc = $gOPD(value, part);
                      isOwn = !!desc;
                      if (isOwn && "get" in desc && !("originalValue" in desc.get)) {
                          value = desc.get
                      } else {
                          value = value[part]
                      }
                  } else {
                      isOwn = hasOwn(value, part);
                      value = value[part]
                  }
                  if (isOwn && !skipFurtherCaching) {
                      INTRINSICS[intrinsicRealName] = value
                  }
              }
          }
          return value
      }
  }, {
      "function-bind": 23,
      has: 28,
      "has-symbols": 25
  }],
  25: [function (require, module, exports) {
      "use strict";
      var origSymbol = typeof Symbol !== "undefined" && Symbol;
      var hasSymbolSham = require("./shams");
      module.exports = function hasNativeSymbols() {
          if (typeof origSymbol !== "function") {
              return false
          }
          if (typeof Symbol !== "function") {
              return false
          }
          if (typeof origSymbol("foo") !== "symbol") {
              return false
          }
          if (typeof Symbol("bar") !== "symbol") {
              return false
          }
          return hasSymbolSham()
      }
  }, {
      "./shams": 26
  }],
  26: [function (require, module, exports) {
      "use strict";
      module.exports = function hasSymbols() {
          if (typeof Symbol !== "function" || typeof Object.getOwnPropertySymbols !== "function") {
              return false
          }
          if (typeof Symbol.iterator === "symbol") {
              return true
          }
          var obj = {};
          var sym = Symbol("test");
          var symObj = Object(sym);
          if (typeof sym === "string") {
              return false
          }
          if (Object.prototype.toString.call(sym) !== "[object Symbol]") {
              return false
          }
          if (Object.prototype.toString.call(symObj) !== "[object Symbol]") {
              return false
          }
          var symVal = 42;
          obj[sym] = symVal;
          for (sym in obj) {
              return false
          }
          if (typeof Object.keys === "function" && Object.keys(obj).length !== 0) {
              return false
          }
          if (typeof Object.getOwnPropertyNames === "function" && Object.getOwnPropertyNames(obj).length !== 0) {
              return false
          }
          var syms = Object.getOwnPropertySymbols(obj);
          if (syms.length !== 1 || syms[0] !== sym) {
              return false
          }
          if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
              return false
          }
          if (typeof Object.getOwnPropertyDescriptor === "function") {
              var descriptor = Object.getOwnPropertyDescriptor(obj, sym);
              if (descriptor.value !== symVal || descriptor.enumerable !== true) {
                  return false
              }
          }
          return true
      }
  }, {}],
  27: [function (require, module, exports) {
      "use strict";
      var hasSymbols = require("has-symbols/shams");
      module.exports = function hasToStringTagShams() {
          return hasSymbols() && !!Symbol.toStringTag
      }
  }, {
      "has-symbols/shams": 26
  }],
  28: [function (require, module, exports) {
      "use strict";
      var bind = require("function-bind");
      module.exports = bind.call(Function.call, Object.prototype.hasOwnProperty)
  }, {
      "function-bind": 23
  }],
  29: [function (require, module, exports) {
      exports.read = function (buffer, offset, isLE, mLen, nBytes) {
          var e, m;
          var eLen = nBytes * 8 - mLen - 1;
          var eMax = (1 << eLen) - 1;
          var eBias = eMax >> 1;
          var nBits = -7;
          var i = isLE ? nBytes - 1 : 0;
          var d = isLE ? -1 : 1;
          var s = buffer[offset + i];
          i += d;
          e = s & (1 << -nBits) - 1;
          s >>= -nBits;
          nBits += eLen;
          for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}
          m = e & (1 << -nBits) - 1;
          e >>= -nBits;
          nBits += mLen;
          for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}
          if (e === 0) {
              e = 1 - eBias
          } else if (e === eMax) {
              return m ? NaN : (s ? -1 : 1) * Infinity
          } else {
              m = m + Math.pow(2, mLen);
              e = e - eBias
          }
          return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
      };
      exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
          var e, m, c;
          var eLen = nBytes * 8 - mLen - 1;
          var eMax = (1 << eLen) - 1;
          var eBias = eMax >> 1;
          var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
          var i = isLE ? 0 : nBytes - 1;
          var d = isLE ? 1 : -1;
          var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
          value = Math.abs(value);
          if (isNaN(value) || value === Infinity) {
              m = isNaN(value) ? 1 : 0;
              e = eMax
          } else {
              e = Math.floor(Math.log(value) / Math.LN2);
              if (value * (c = Math.pow(2, -e)) < 1) {
                  e--;
                  c *= 2
              }
              if (e + eBias >= 1) {
                  value += rt / c
              } else {
                  value += rt * Math.pow(2, 1 - eBias)
              }
              if (value * c >= 2) {
                  e++;
                  c /= 2
              }
              if (e + eBias >= eMax) {
                  m = 0;
                  e = eMax
              } else if (e + eBias >= 1) {
                  m = (value * c - 1) * Math.pow(2, mLen);
                  e = e + eBias
              } else {
                  m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                  e = 0
              }
          }
          for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {}
          e = e << mLen | m;
          eLen += mLen;
          for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {}
          buffer[offset + i - d] |= s * 128
      }
  }, {}],
  30: [function (require, module, exports) {
      if (typeof Object.create === "function") {
          module.exports = function inherits(ctor, superCtor) {
              if (superCtor) {
                  ctor.super_ = superCtor;
                  ctor.prototype = Object.create(superCtor.prototype, {
                      constructor: {
                          value: ctor,
                          enumerable: false,
                          writable: true,
                          configurable: true
                      }
                  })
              }
          }
      } else {
          module.exports = function inherits(ctor, superCtor) {
              if (superCtor) {
                  ctor.super_ = superCtor;
                  var TempCtor = function () {};
                  TempCtor.prototype = superCtor.prototype;
                  ctor.prototype = new TempCtor;
                  ctor.prototype.constructor = ctor
              }
          }
      }
  }, {}],
  31: [function (require, module, exports) {
      "use strict";
      var hasToStringTag = require("has-tostringtag/shams")();
      var callBound = require("call-bind/callBound");
      var $toString = callBound("Object.prototype.toString");
      var isStandardArguments = function isArguments(value) {
          if (hasToStringTag && value && typeof value === "object" && Symbol.toStringTag in value) {
              return false
          }
          return $toString(value) === "[object Arguments]"
      };
      var isLegacyArguments = function isArguments(value) {
          if (isStandardArguments(value)) {
              return true
          }
          return value !== null && typeof value === "object" && typeof value.length === "number" && value.length >= 0 && $toString(value) !== "[object Array]" && $toString(value.callee) === "[object Function]"
      };
      var supportsStandardArguments = function () {
          return isStandardArguments(arguments)
      }();
      isStandardArguments.isLegacyArguments = isLegacyArguments;
      module.exports = supportsStandardArguments ? isStandardArguments : isLegacyArguments
  }, {
      "call-bind/callBound": 17,
      "has-tostringtag/shams": 27
  }],
  32: [function (require, module, exports) {
      "use strict";
      var fnToStr = Function.prototype.toString;
      var reflectApply = typeof Reflect === "object" && Reflect !== null && Reflect.apply;
      var badArrayLike;
      var isCallableMarker;
      if (typeof reflectApply === "function" && typeof Object.defineProperty === "function") {
          try {
              badArrayLike = Object.defineProperty({}, "length", {
                  get: function () {
                      throw isCallableMarker
                  }
              });
              isCallableMarker = {};
              reflectApply(function () {
                  throw 42
              }, null, badArrayLike)
          } catch (_) {
              if (_ !== isCallableMarker) {
                  reflectApply = null
              }
          }
      } else {
          reflectApply = null
      }
      var constructorRegex = /^\s*class\b/;
      var isES6ClassFn = function isES6ClassFunction(value) {
          try {
              var fnStr = fnToStr.call(value);
              return constructorRegex.test(fnStr)
          } catch (e) {
              return false
          }
      };
      var tryFunctionObject = function tryFunctionToStr(value) {
          try {
              if (isES6ClassFn(value)) {
                  return false
              }
              fnToStr.call(value);
              return true
          } catch (e) {
              return false
          }
      };
      var toStr = Object.prototype.toString;
      var fnClass = "[object Function]";
      var genClass = "[object GeneratorFunction]";
      var hasToStringTag = typeof Symbol === "function" && !!Symbol.toStringTag;
      var documentDotAll = typeof document === "object" && typeof document.all === "undefined" && document.all !== undefined ? document.all : {};
      module.exports = reflectApply ? function isCallable(value) {
          if (value === documentDotAll) {
              return true
          }
          if (!value) {
              return false
          }
          if (typeof value !== "function" && typeof value !== "object") {
              return false
          }
          if (typeof value === "function" && !value.prototype) {
              return true
          }
          try {
              reflectApply(value, null, badArrayLike)
          } catch (e) {
              if (e !== isCallableMarker) {
                  return false
              }
          }
          return !isES6ClassFn(value)
      } : function isCallable(value) {
          if (value === documentDotAll) {
              return true
          }
          if (!value) {
              return false
          }
          if (typeof value !== "function" && typeof value !== "object") {
              return false
          }
          if (typeof value === "function" && !value.prototype) {
              return true
          }
          if (hasToStringTag) {
              return tryFunctionObject(value)
          }
          if (isES6ClassFn(value)) {
              return false
          }
          var strClass = toStr.call(value);
          return strClass === fnClass || strClass === genClass
      }
  }, {}],
  33: [function (require, module, exports) {
      "use strict";
      var toStr = Object.prototype.toString;
      var fnToStr = Function.prototype.toString;
      var isFnRegex = /^\s*(?:function)?\*/;
      var hasToStringTag = require("has-tostringtag/shams")();
      var getProto = Object.getPrototypeOf;
      var getGeneratorFunc = function () {
          if (!hasToStringTag) {
              return false
          }
          try {
              return Function("return function*() {}")()
          } catch (e) {}
      };
      var GeneratorFunction;
      module.exports = function isGeneratorFunction(fn) {
          if (typeof fn !== "function") {
              return false
          }
          if (isFnRegex.test(fnToStr.call(fn))) {
              return true
          }
          if (!hasToStringTag) {
              var str = toStr.call(fn);
              return str === "[object GeneratorFunction]"
          }
          if (!getProto) {
              return false
          }
          if (typeof GeneratorFunction === "undefined") {
              var generatorFunc = getGeneratorFunc();
              GeneratorFunction = generatorFunc ? getProto(generatorFunc) : false
          }
          return getProto(fn) === GeneratorFunction
      }
  }, {
      "has-tostringtag/shams": 27
  }],
  34: [function (require, module, exports) {
      (function (global) {
          (function () {
              "use strict";
              var forEach = require("for-each");
              var availableTypedArrays = require("available-typed-arrays");
              var callBound = require("call-bind/callBound");
              var $toString = callBound("Object.prototype.toString");
              var hasToStringTag = require("has-tostringtag/shams")();
              var g = typeof globalThis === "undefined" ? global : globalThis;
              var typedArrays = availableTypedArrays();
              var $indexOf = callBound("Array.prototype.indexOf", true) || function indexOf(array, value) {
                  for (var i = 0; i < array.length; i += 1) {
                      if (array[i] === value) {
                          return i
                      }
                  }
                  return -1
              };
              var $slice = callBound("String.prototype.slice");
              var toStrTags = {};
              var gOPD = require("es-abstract/helpers/getOwnPropertyDescriptor");
              var getPrototypeOf = Object.getPrototypeOf;
              if (hasToStringTag && gOPD && getPrototypeOf) {
                  forEach(typedArrays, function (typedArray) {
                      var arr = new g[typedArray];
                      if (Symbol.toStringTag in arr) {
                          var proto = getPrototypeOf(arr);
                          var descriptor = gOPD(proto, Symbol.toStringTag);
                          if (!descriptor) {
                              var superProto = getPrototypeOf(proto);
                              descriptor = gOPD(superProto, Symbol.toStringTag)
                          }
                          toStrTags[typedArray] = descriptor.get
                      }
                  })
              }
              var tryTypedArrays = function tryAllTypedArrays(value) {
                  var anyTrue = false;
                  forEach(toStrTags, function (getter, typedArray) {
                      if (!anyTrue) {
                          try {
                              anyTrue = getter.call(value) === typedArray
                          } catch (e) {}
                      }
                  });
                  return anyTrue
              };
              module.exports = function isTypedArray(value) {
                  if (!value || typeof value !== "object") {
                      return false
                  }
                  if (!hasToStringTag || !(Symbol.toStringTag in value)) {
                      var tag = $slice($toString(value), 8, -1);
                      return $indexOf(typedArrays, tag) > -1
                  }
                  if (!gOPD) {
                      return false
                  }
                  return tryTypedArrays(value)
              }
          }).call(this)
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  }, {
      "available-typed-arrays": 11,
      "call-bind/callBound": 17,
      "es-abstract/helpers/getOwnPropertyDescriptor": 19,
      "for-each": 21,
      "has-tostringtag/shams": 27
  }],
  35: [function (require, module, exports) {
      "use strict";
      var getOwnPropertySymbols = Object.getOwnPropertySymbols;
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var propIsEnumerable = Object.prototype.propertyIsEnumerable;

      function toObject(val) {
          if (val === null || val === undefined) {
              throw new TypeError("Object.assign cannot be called with null or undefined")
          }
          return Object(val)
      }

      function shouldUseNative() {
          try {
              if (!Object.assign) {
                  return false
              }
              var test1 = new String("abc");
              test1[5] = "de";
              if (Object.getOwnPropertyNames(test1)[0] === "5") {
                  return false
              }
              var test2 = {};
              for (var i = 0; i < 10; i++) {
                  test2["_" + String.fromCharCode(i)] = i
              }
              var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
                  return test2[n]
              });
              if (order2.join("") !== "0123456789") {
                  return false
              }
              var test3 = {};
              "abcdefghijklmnopqrst".split("").forEach(function (letter) {
                  test3[letter] = letter
              });
              if (Object.keys(Object.assign({}, test3)).join("") !== "abcdefghijklmnopqrst") {
                  return false
              }
              return true
          } catch (err) {
              return false
          }
      }
      module.exports = shouldUseNative() ? Object.assign : function (target, source) {
          var from;
          var to = toObject(target);
          var symbols;
          for (var s = 1; s < arguments.length; s++) {
              from = Object(arguments[s]);
              for (var key in from) {
                  if (hasOwnProperty.call(from, key)) {
                      to[key] = from[key]
                  }
              }
              if (getOwnPropertySymbols) {
                  symbols = getOwnPropertySymbols(from);
                  for (var i = 0; i < symbols.length; i++) {
                      if (propIsEnumerable.call(from, symbols[i])) {
                          to[symbols[i]] = from[symbols[i]]
                      }
                  }
              }
          }
          return to
      }
  }, {}],
  36: [function (require, module, exports) {
      var process = module.exports = {};
      var cachedSetTimeout;
      var cachedClearTimeout;

      function defaultSetTimout() {
          throw new Error("setTimeout has not been defined")
      }

      function defaultClearTimeout() {
          throw new Error("clearTimeout has not been defined")
      }(function () {
          try {
              if (typeof setTimeout === "function") {
                  cachedSetTimeout = setTimeout
              } else {
                  cachedSetTimeout = defaultSetTimout
              }
          } catch (e) {
              cachedSetTimeout = defaultSetTimout
          }
          try {
              if (typeof clearTimeout === "function") {
                  cachedClearTimeout = clearTimeout
              } else {
                  cachedClearTimeout = defaultClearTimeout
              }
          } catch (e) {
              cachedClearTimeout = defaultClearTimeout
          }
      })();

      function runTimeout(fun) {
          if (cachedSetTimeout === setTimeout) {
              return setTimeout(fun, 0)
          }
          if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
              cachedSetTimeout = setTimeout;
              return setTimeout(fun, 0)
          }
          try {
              return cachedSetTimeout(fun, 0)
          } catch (e) {
              try {
                  return cachedSetTimeout.call(null, fun, 0)
              } catch (e) {
                  return cachedSetTimeout.call(this, fun, 0)
              }
          }
      }

      function runClearTimeout(marker) {
          if (cachedClearTimeout === clearTimeout) {
              return clearTimeout(marker)
          }
          if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
              cachedClearTimeout = clearTimeout;
              return clearTimeout(marker)
          }
          try {
              return cachedClearTimeout(marker)
          } catch (e) {
              try {
                  return cachedClearTimeout.call(null, marker)
              } catch (e) {
                  return cachedClearTimeout.call(this, marker)
              }
          }
      }
      var queue = [];
      var draining = false;
      var currentQueue;
      var queueIndex = -1;

      function cleanUpNextTick() {
          if (!draining || !currentQueue) {
              return
          }
          draining = false;
          if (currentQueue.length) {
              queue = currentQueue.concat(queue)
          } else {
              queueIndex = -1
          }
          if (queue.length) {
              drainQueue()
          }
      }

      function drainQueue() {
          if (draining) {
              return
          }
          var timeout = runTimeout(cleanUpNextTick);
          draining = true;
          var len = queue.length;
          while (len) {
              currentQueue = queue;
              queue = [];
              while (++queueIndex < len) {
                  if (currentQueue) {
                      currentQueue[queueIndex].run()
                  }
              }
              queueIndex = -1;
              len = queue.length
          }
          currentQueue = null;
          draining = false;
          runClearTimeout(timeout)
      }
      process.nextTick = function (fun) {
          var args = new Array(arguments.length - 1);
          if (arguments.length > 1) {
              for (var i = 1; i < arguments.length; i++) {
                  args[i - 1] = arguments[i]
              }
          }
          queue.push(new Item(fun, args));
          if (queue.length === 1 && !draining) {
              runTimeout(drainQueue)
          }
      };

      function Item(fun, array) {
          this.fun = fun;
          this.array = array
      }
      Item.prototype.run = function () {
          this.fun.apply(null, this.array)
      };
      process.title = "browser";
      process.browser = true;
      process.env = {};
      process.argv = [];
      process.version = "";
      process.versions = {};

      function noop() {}
      process.on = noop;
      process.addListener = noop;
      process.once = noop;
      process.off = noop;
      process.removeListener = noop;
      process.removeAllListeners = noop;
      process.emit = noop;
      process.prependListener = noop;
      process.prependOnceListener = noop;
      process.listeners = function (name) {
          return []
      };
      process.binding = function (name) {
          throw new Error("process.binding is not supported")
      };
      process.cwd = function () {
          return "/"
      };
      process.chdir = function (dir) {
          throw new Error("process.chdir is not supported")
      };
      process.umask = function () {
          return 0
      }
  }, {}],
  37: [function (require, module, exports) {
      "use strict";

      function _inheritsLoose(subClass, superClass) {
          subClass.prototype = Object.create(superClass.prototype);
          subClass.prototype.constructor = subClass;
          subClass.__proto__ = superClass
      }
      var codes = {};

      function createErrorType(code, message, Base) {
          if (!Base) {
              Base = Error
          }

          function getMessage(arg1, arg2, arg3) {
              if (typeof message === "string") {
                  return message
              } else {
                  return message(arg1, arg2, arg3)
              }
          }
          var NodeError = function (_Base) {
              _inheritsLoose(NodeError, _Base);

              function NodeError(arg1, arg2, arg3) {
                  return _Base.call(this, getMessage(arg1, arg2, arg3)) || this
              }
              return NodeError
          }(Base);
          NodeError.prototype.name = Base.name;
          NodeError.prototype.code = code;
          codes[code] = NodeError
      }

      function oneOf(expected, thing) {
          if (Array.isArray(expected)) {
              var len = expected.length;
              expected = expected.map(function (i) {
                  return String(i)
              });
              if (len > 2) {
                  return "one of ".concat(thing, " ").concat(expected.slice(0, len - 1).join(", "), ", or ") + expected[len - 1]
              } else if (len === 2) {
                  return "one of ".concat(thing, " ").concat(expected[0], " or ").concat(expected[1])
              } else {
                  return "of ".concat(thing, " ").concat(expected[0])
              }
          } else {
              return "of ".concat(thing, " ").concat(String(expected))
          }
      }

      function startsWith(str, search, pos) {
          return str.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search
      }

      function endsWith(str, search, this_len) {
          if (this_len === undefined || this_len > str.length) {
              this_len = str.length
          }
          return str.substring(this_len - search.length, this_len) === search
      }

      function includes(str, search, start) {
          if (typeof start !== "number") {
              start = 0
          }
          if (start + search.length > str.length) {
              return false
          } else {
              return str.indexOf(search, start) !== -1
          }
      }
      createErrorType("ERR_INVALID_OPT_VALUE", function (name, value) {
          return 'The value "' + value + '" is invalid for option "' + name + '"'
      }, TypeError);
      createErrorType("ERR_INVALID_ARG_TYPE", function (name, expected, actual) {
          var determiner;
          if (typeof expected === "string" && startsWith(expected, "not ")) {
              determiner = "must not be";
              expected = expected.replace(/^not /, "")
          } else {
              determiner = "must be"
          }
          var msg;
          if (endsWith(name, " argument")) {
              msg = "The ".concat(name, " ").concat(determiner, " ").concat(oneOf(expected, "type"))
          } else {
              var type = includes(name, ".") ? "property" : "argument";
              msg = 'The "'.concat(name, '" ').concat(type, " ").concat(determiner, " ").concat(oneOf(expected, "type"))
          }
          msg += ". Received type ".concat(typeof actual);
          return msg
      }, TypeError);
      createErrorType("ERR_STREAM_PUSH_AFTER_EOF", "stream.push() after EOF");
      createErrorType("ERR_METHOD_NOT_IMPLEMENTED", function (name) {
          return "The " + name + " method is not implemented"
      });
      createErrorType("ERR_STREAM_PREMATURE_CLOSE", "Premature close");
      createErrorType("ERR_STREAM_DESTROYED", function (name) {
          return "Cannot call " + name + " after a stream was destroyed"
      });
      createErrorType("ERR_MULTIPLE_CALLBACK", "Callback called multiple times");
      createErrorType("ERR_STREAM_CANNOT_PIPE", "Cannot pipe, not readable");
      createErrorType("ERR_STREAM_WRITE_AFTER_END", "write after end");
      createErrorType("ERR_STREAM_NULL_VALUES", "May not write null values to stream", TypeError);
      createErrorType("ERR_UNKNOWN_ENCODING", function (arg) {
          return "Unknown encoding: " + arg
      }, TypeError);
      createErrorType("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", "stream.unshift() after end event");
      module.exports.codes = codes
  }, {}],
  38: [function (require, module, exports) {
      (function (process) {
          (function () {
              "use strict";
              var objectKeys = Object.keys || function (obj) {
                  var keys = [];
                  for (var key in obj) {
                      keys.push(key)
                  }
                  return keys
              };
              module.exports = Duplex;
              var Readable = require("./_stream_readable");
              var Writable = require("./_stream_writable");
              require("inherits")(Duplex, Readable); {
                  var keys = objectKeys(Writable.prototype);
                  for (var v = 0; v < keys.length; v++) {
                      var method = keys[v];
                      if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method]
                  }
              }

              function Duplex(options) {
                  if (!(this instanceof Duplex)) return new Duplex(options);
                  Readable.call(this, options);
                  Writable.call(this, options);
                  this.allowHalfOpen = true;
                  if (options) {
                      if (options.readable === false) this.readable = false;
                      if (options.writable === false) this.writable = false;
                      if (options.allowHalfOpen === false) {
                          this.allowHalfOpen = false;
                          this.once("end", onend)
                      }
                  }
              }
              Object.defineProperty(Duplex.prototype, "writableHighWaterMark", {
                  enumerable: false,
                  get: function get() {
                      return this._writableState.highWaterMark
                  }
              });
              Object.defineProperty(Duplex.prototype, "writableBuffer", {
                  enumerable: false,
                  get: function get() {
                      return this._writableState && this._writableState.getBuffer()
                  }
              });
              Object.defineProperty(Duplex.prototype, "writableLength", {
                  enumerable: false,
                  get: function get() {
                      return this._writableState.length
                  }
              });

              function onend() {
                  if (this._writableState.ended) return;
                  process.nextTick(onEndNT, this)
              }

              function onEndNT(self) {
                  self.end()
              }
              Object.defineProperty(Duplex.prototype, "destroyed", {
                  enumerable: false,
                  get: function get() {
                      if (this._readableState === undefined || this._writableState === undefined) {
                          return false
                      }
                      return this._readableState.destroyed && this._writableState.destroyed
                  },
                  set: function set(value) {
                      if (this._readableState === undefined || this._writableState === undefined) {
                          return
                      }
                      this._readableState.destroyed = value;
                      this._writableState.destroyed = value
                  }
              })
          }).call(this)
      }).call(this, require("_process"))
  }, {
      "./_stream_readable": 40,
      "./_stream_writable": 42,
      _process: 36,
      inherits: 30
  }],
  39: [function (require, module, exports) {
      "use strict";
      module.exports = PassThrough;
      var Transform = require("./_stream_transform");
      require("inherits")(PassThrough, Transform);

      function PassThrough(options) {
          if (!(this instanceof PassThrough)) return new PassThrough(options);
          Transform.call(this, options)
      }
      PassThrough.prototype._transform = function (chunk, encoding, cb) {
          cb(null, chunk)
      }
  }, {
      "./_stream_transform": 41,
      inherits: 30
  }],
  40: [function (require, module, exports) {
      (function (process, global) {
          (function () {
              "use strict";
              module.exports = Readable;
              var Duplex;
              Readable.ReadableState = ReadableState;
              var EE = require("events").EventEmitter;
              var EElistenerCount = function EElistenerCount(emitter, type) {
                  return emitter.listeners(type).length
              };
              var Stream = require("./internal/streams/stream");
              var Buffer = require("buffer").Buffer;
              var OurUint8Array = global.Uint8Array || function () {};

              function _uint8ArrayToBuffer(chunk) {
                  return Buffer.from(chunk)
              }

              function _isUint8Array(obj) {
                  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array
              }
              var debugUtil = require("util");
              var debug;
              if (debugUtil && debugUtil.debuglog) {
                  debug = debugUtil.debuglog("stream")
              } else {
                  debug = function debug() {}
              }
              var BufferList = require("./internal/streams/buffer_list");
              var destroyImpl = require("./internal/streams/destroy");
              var _require = require("./internal/streams/state"),
                  getHighWaterMark = _require.getHighWaterMark;
              var _require$codes = require("../errors").codes,
                  ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE,
                  ERR_STREAM_PUSH_AFTER_EOF = _require$codes.ERR_STREAM_PUSH_AFTER_EOF,
                  ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
                  ERR_STREAM_UNSHIFT_AFTER_END_EVENT = _require$codes.ERR_STREAM_UNSHIFT_AFTER_END_EVENT;
              var StringDecoder;
              var createReadableStreamAsyncIterator;
              var from;
              require("inherits")(Readable, Stream);
              var errorOrDestroy = destroyImpl.errorOrDestroy;
              var kProxyEvents = ["error", "close", "destroy", "pause", "resume"];

              function prependListener(emitter, event, fn) {
                  if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
                  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
                  else if (Array.isArray(emitter._events[event])) emitter._events[event].unshift(fn);
                  else emitter._events[event] = [fn, emitter._events[event]]
              }

              function ReadableState(options, stream, isDuplex) {
                  Duplex = Duplex || require("./_stream_duplex");
                  options = options || {};
                  if (typeof isDuplex !== "boolean") isDuplex = stream instanceof Duplex;
                  this.objectMode = !!options.objectMode;
                  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
                  this.highWaterMark = getHighWaterMark(this, options, "readableHighWaterMark", isDuplex);
                  this.buffer = new BufferList;
                  this.length = 0;
                  this.pipes = null;
                  this.pipesCount = 0;
                  this.flowing = null;
                  this.ended = false;
                  this.endEmitted = false;
                  this.reading = false;
                  this.sync = true;
                  this.needReadable = false;
                  this.emittedReadable = false;
                  this.readableListening = false;
                  this.resumeScheduled = false;
                  this.paused = true;
                  this.emitClose = options.emitClose !== false;
                  this.autoDestroy = !!options.autoDestroy;
                  this.destroyed = false;
                  this.defaultEncoding = options.defaultEncoding || "utf8";
                  this.awaitDrain = 0;
                  this.readingMore = false;
                  this.decoder = null;
                  this.encoding = null;
                  if (options.encoding) {
                      if (!StringDecoder) StringDecoder = require("string_decoder/").StringDecoder;
                      this.decoder = new StringDecoder(options.encoding);
                      this.encoding = options.encoding
                  }
              }

              function Readable(options) {
                  Duplex = Duplex || require("./_stream_duplex");
                  if (!(this instanceof Readable)) return new Readable(options);
                  var isDuplex = this instanceof Duplex;
                  this._readableState = new ReadableState(options, this, isDuplex);
                  this.readable = true;
                  if (options) {
                      if (typeof options.read === "function") this._read = options.read;
                      if (typeof options.destroy === "function") this._destroy = options.destroy
                  }
                  Stream.call(this)
              }
              Object.defineProperty(Readable.prototype, "destroyed", {
                  enumerable: false,
                  get: function get() {
                      if (this._readableState === undefined) {
                          return false
                      }
                      return this._readableState.destroyed
                  },
                  set: function set(value) {
                      if (!this._readableState) {
                          return
                      }
                      this._readableState.destroyed = value
                  }
              });
              Readable.prototype.destroy = destroyImpl.destroy;
              Readable.prototype._undestroy = destroyImpl.undestroy;
              Readable.prototype._destroy = function (err, cb) {
                  cb(err)
              };
              Readable.prototype.push = function (chunk, encoding) {
                  var state = this._readableState;
                  var skipChunkCheck;
                  if (!state.objectMode) {
                      if (typeof chunk === "string") {
                          encoding = encoding || state.defaultEncoding;
                          if (encoding !== state.encoding) {
                              chunk = Buffer.from(chunk, encoding);
                              encoding = ""
                          }
                          skipChunkCheck = true
                      }
                  } else {
                      skipChunkCheck = true
                  }
                  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck)
              };
              Readable.prototype.unshift = function (chunk) {
                  return readableAddChunk(this, chunk, null, true, false)
              };

              function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
                  debug("readableAddChunk", chunk);
                  var state = stream._readableState;
                  if (chunk === null) {
                      state.reading = false;
                      onEofChunk(stream, state)
                  } else {
                      var er;
                      if (!skipChunkCheck) er = chunkInvalid(state, chunk);
                      if (er) {
                          errorOrDestroy(stream, er)
                      } else if (state.objectMode || chunk && chunk.length > 0) {
                          if (typeof chunk !== "string" && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
                              chunk = _uint8ArrayToBuffer(chunk)
                          }
                          if (addToFront) {
                              if (state.endEmitted) errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT);
                              else addChunk(stream, state, chunk, true)
                          } else if (state.ended) {
                              errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF)
                          } else if (state.destroyed) {
                              return false
                          } else {
                              state.reading = false;
                              if (state.decoder && !encoding) {
                                  chunk = state.decoder.write(chunk);
                                  if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);
                                  else maybeReadMore(stream, state)
                              } else {
                                  addChunk(stream, state, chunk, false)
                              }
                          }
                      } else if (!addToFront) {
                          state.reading = false;
                          maybeReadMore(stream, state)
                      }
                  }
                  return !state.ended && (state.length < state.highWaterMark || state.length === 0)
              }

              function addChunk(stream, state, chunk, addToFront) {
                  if (state.flowing && state.length === 0 && !state.sync) {
                      state.awaitDrain = 0;
                      stream.emit("data", chunk)
                  } else {
                      state.length += state.objectMode ? 1 : chunk.length;
                      if (addToFront) state.buffer.unshift(chunk);
                      else state.buffer.push(chunk);
                      if (state.needReadable) emitReadable(stream)
                  }
                  maybeReadMore(stream, state)
              }

              function chunkInvalid(state, chunk) {
                  var er;
                  if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== undefined && !state.objectMode) {
                      er = new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer", "Uint8Array"], chunk)
                  }
                  return er
              }
              Readable.prototype.isPaused = function () {
                  return this._readableState.flowing === false
              };
              Readable.prototype.setEncoding = function (enc) {
                  if (!StringDecoder) StringDecoder = require("string_decoder/").StringDecoder;
                  var decoder = new StringDecoder(enc);
                  this._readableState.decoder = decoder;
                  this._readableState.encoding = this._readableState.decoder.encoding;
                  var p = this._readableState.buffer.head;
                  var content = "";
                  while (p !== null) {
                      content += decoder.write(p.data);
                      p = p.next
                  }
                  this._readableState.buffer.clear();
                  if (content !== "") this._readableState.buffer.push(content);
                  this._readableState.length = content.length;
                  return this
              };
              var MAX_HWM = 1073741824;

              function computeNewHighWaterMark(n) {
                  if (n >= MAX_HWM) {
                      n = MAX_HWM
                  } else {
                      n--;
                      n |= n >>> 1;
                      n |= n >>> 2;
                      n |= n >>> 4;
                      n |= n >>> 8;
                      n |= n >>> 16;
                      n++
                  }
                  return n
              }

              function howMuchToRead(n, state) {
                  if (n <= 0 || state.length === 0 && state.ended) return 0;
                  if (state.objectMode) return 1;
                  if (n !== n) {
                      if (state.flowing && state.length) return state.buffer.head.data.length;
                      else return state.length
                  }
                  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
                  if (n <= state.length) return n;
                  if (!state.ended) {
                      state.needReadable = true;
                      return 0
                  }
                  return state.length
              }
              Readable.prototype.read = function (n) {
                  debug("read", n);
                  n = parseInt(n, 10);
                  var state = this._readableState;
                  var nOrig = n;
                  if (n !== 0) state.emittedReadable = false;
                  if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
                      debug("read: emitReadable", state.length, state.ended);
                      if (state.length === 0 && state.ended) endReadable(this);
                      else emitReadable(this);
                      return null
                  }
                  n = howMuchToRead(n, state);
                  if (n === 0 && state.ended) {
                      if (state.length === 0) endReadable(this);
                      return null
                  }
                  var doRead = state.needReadable;
                  debug("need readable", doRead);
                  if (state.length === 0 || state.length - n < state.highWaterMark) {
                      doRead = true;
                      debug("length less than watermark", doRead)
                  }
                  if (state.ended || state.reading) {
                      doRead = false;
                      debug("reading or ended", doRead)
                  } else if (doRead) {
                      debug("do read");
                      state.reading = true;
                      state.sync = true;
                      if (state.length === 0) state.needReadable = true;
                      this._read(state.highWaterMark);
                      state.sync = false;
                      if (!state.reading) n = howMuchToRead(nOrig, state)
                  }
                  var ret;
                  if (n > 0) ret = fromList(n, state);
                  else ret = null;
                  if (ret === null) {
                      state.needReadable = state.length <= state.highWaterMark;
                      n = 0
                  } else {
                      state.length -= n;
                      state.awaitDrain = 0
                  }
                  if (state.length === 0) {
                      if (!state.ended) state.needReadable = true;
                      if (nOrig !== n && state.ended) endReadable(this)
                  }
                  if (ret !== null) this.emit("data", ret);
                  return ret
              };

              function onEofChunk(stream, state) {
                  debug("onEofChunk");
                  if (state.ended) return;
                  if (state.decoder) {
                      var chunk = state.decoder.end();
                      if (chunk && chunk.length) {
                          state.buffer.push(chunk);
                          state.length += state.objectMode ? 1 : chunk.length
                      }
                  }
                  state.ended = true;
                  if (state.sync) {
                      emitReadable(stream)
                  } else {
                      state.needReadable = false;
                      if (!state.emittedReadable) {
                          state.emittedReadable = true;
                          emitReadable_(stream)
                      }
                  }
              }

              function emitReadable(stream) {
                  var state = stream._readableState;
                  debug("emitReadable", state.needReadable, state.emittedReadable);
                  state.needReadable = false;
                  if (!state.emittedReadable) {
                      debug("emitReadable", state.flowing);
                      state.emittedReadable = true;
                      process.nextTick(emitReadable_, stream)
                  }
              }

              function emitReadable_(stream) {
                  var state = stream._readableState;
                  debug("emitReadable_", state.destroyed, state.length, state.ended);
                  if (!state.destroyed && (state.length || state.ended)) {
                      stream.emit("readable");
                      state.emittedReadable = false
                  }
                  state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark;
                  flow(stream)
              }

              function maybeReadMore(stream, state) {
                  if (!state.readingMore) {
                      state.readingMore = true;
                      process.nextTick(maybeReadMore_, stream, state)
                  }
              }

              function maybeReadMore_(stream, state) {
                  while (!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)) {
                      var len = state.length;
                      debug("maybeReadMore read 0");
                      stream.read(0);
                      if (len === state.length) break
                  }
                  state.readingMore = false
              }
              Readable.prototype._read = function (n) {
                  errorOrDestroy(this, new ERR_METHOD_NOT_IMPLEMENTED("_read()"))
              };
              Readable.prototype.pipe = function (dest, pipeOpts) {
                  var src = this;
                  var state = this._readableState;
                  switch (state.pipesCount) {
                      case 0:
                          state.pipes = dest;
                          break;
                      case 1:
                          state.pipes = [state.pipes, dest];
                          break;
                      default:
                          state.pipes.push(dest);
                          break
                  }
                  state.pipesCount += 1;
                  debug("pipe count=%d opts=%j", state.pipesCount, pipeOpts);
                  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
                  var endFn = doEnd ? onend : unpipe;
                  if (state.endEmitted) process.nextTick(endFn);
                  else src.once("end", endFn);
                  dest.on("unpipe", onunpipe);

                  function onunpipe(readable, unpipeInfo) {
                      debug("onunpipe");
                      if (readable === src) {
                          if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
                              unpipeInfo.hasUnpiped = true;
                              cleanup()
                          }
                      }
                  }

                  function onend() {
                      debug("onend");
                      dest.end()
                  }
                  var ondrain = pipeOnDrain(src);
                  dest.on("drain", ondrain);
                  var cleanedUp = false;

                  function cleanup() {
                      debug("cleanup");
                      dest.removeListener("close", onclose);
                      dest.removeListener("finish", onfinish);
                      dest.removeListener("drain", ondrain);
                      dest.removeListener("error", onerror);
                      dest.removeListener("unpipe", onunpipe);
                      src.removeListener("end", onend);
                      src.removeListener("end", unpipe);
                      src.removeListener("data", ondata);
                      cleanedUp = true;
                      if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain()
                  }
                  src.on("data", ondata);

                  function ondata(chunk) {
                      debug("ondata");
                      var ret = dest.write(chunk);
                      debug("dest.write", ret);
                      if (ret === false) {
                          if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
                              debug("false write response, pause", state.awaitDrain);
                              state.awaitDrain++
                          }
                          src.pause()
                      }
                  }

                  function onerror(er) {
                      debug("onerror", er);
                      unpipe();
                      dest.removeListener("error", onerror);
                      if (EElistenerCount(dest, "error") === 0) errorOrDestroy(dest, er)
                  }
                  prependListener(dest, "error", onerror);

                  function onclose() {
                      dest.removeListener("finish", onfinish);
                      unpipe()
                  }
                  dest.once("close", onclose);

                  function onfinish() {
                      debug("onfinish");
                      dest.removeListener("close", onclose);
                      unpipe()
                  }
                  dest.once("finish", onfinish);

                  function unpipe() {
                      debug("unpipe");
                      src.unpipe(dest)
                  }
                  dest.emit("pipe", src);
                  if (!state.flowing) {
                      debug("pipe resume");
                      src.resume()
                  }
                  return dest
              };

              function pipeOnDrain(src) {
                  return function pipeOnDrainFunctionResult() {
                      var state = src._readableState;
                      debug("pipeOnDrain", state.awaitDrain);
                      if (state.awaitDrain) state.awaitDrain--;
                      if (state.awaitDrain === 0 && EElistenerCount(src, "data")) {
                          state.flowing = true;
                          flow(src)
                      }
                  }
              }
              Readable.prototype.unpipe = function (dest) {
                  var state = this._readableState;
                  var unpipeInfo = {
                      hasUnpiped: false
                  };
                  if (state.pipesCount === 0) return this;
                  if (state.pipesCount === 1) {
                      if (dest && dest !== state.pipes) return this;
                      if (!dest) dest = state.pipes;
                      state.pipes = null;
                      state.pipesCount = 0;
                      state.flowing = false;
                      if (dest) dest.emit("unpipe", this, unpipeInfo);
                      return this
                  }
                  if (!dest) {
                      var dests = state.pipes;
                      var len = state.pipesCount;
                      state.pipes = null;
                      state.pipesCount = 0;
                      state.flowing = false;
                      for (var i = 0; i < len; i++) {
                          dests[i].emit("unpipe", this, {
                              hasUnpiped: false
                          })
                      }
                      return this
                  }
                  var index = indexOf(state.pipes, dest);
                  if (index === -1) return this;
                  state.pipes.splice(index, 1);
                  state.pipesCount -= 1;
                  if (state.pipesCount === 1) state.pipes = state.pipes[0];
                  dest.emit("unpipe", this, unpipeInfo);
                  return this
              };
              Readable.prototype.on = function (ev, fn) {
                  var res = Stream.prototype.on.call(this, ev, fn);
                  var state = this._readableState;
                  if (ev === "data") {
                      state.readableListening = this.listenerCount("readable") > 0;
                      if (state.flowing !== false) this.resume()
                  } else if (ev === "readable") {
                      if (!state.endEmitted && !state.readableListening) {
                          state.readableListening = state.needReadable = true;
                          state.flowing = false;
                          state.emittedReadable = false;
                          debug("on readable", state.length, state.reading);
                          if (state.length) {
                              emitReadable(this)
                          } else if (!state.reading) {
                              process.nextTick(nReadingNextTick, this)
                          }
                      }
                  }
                  return res
              };
              Readable.prototype.addListener = Readable.prototype.on;
              Readable.prototype.removeListener = function (ev, fn) {
                  var res = Stream.prototype.removeListener.call(this, ev, fn);
                  if (ev === "readable") {
                      process.nextTick(updateReadableListening, this)
                  }
                  return res
              };
              Readable.prototype.removeAllListeners = function (ev) {
                  var res = Stream.prototype.removeAllListeners.apply(this, arguments);
                  if (ev === "readable" || ev === undefined) {
                      process.nextTick(updateReadableListening, this)
                  }
                  return res
              };

              function updateReadableListening(self) {
                  var state = self._readableState;
                  state.readableListening = self.listenerCount("readable") > 0;
                  if (state.resumeScheduled && !state.paused) {
                      state.flowing = true
                  } else if (self.listenerCount("data") > 0) {
                      self.resume()
                  }
              }

              function nReadingNextTick(self) {
                  debug("readable nexttick read 0");
                  self.read(0)
              }
              Readable.prototype.resume = function () {
                  var state = this._readableState;
                  if (!state.flowing) {
                      debug("resume");
                      state.flowing = !state.readableListening;
                      resume(this, state)
                  }
                  state.paused = false;
                  return this
              };

              function resume(stream, state) {
                  if (!state.resumeScheduled) {
                      state.resumeScheduled = true;
                      process.nextTick(resume_, stream, state)
                  }
              }

              function resume_(stream, state) {
                  debug("resume", state.reading);
                  if (!state.reading) {
                      stream.read(0)
                  }
                  state.resumeScheduled = false;
                  stream.emit("resume");
                  flow(stream);
                  if (state.flowing && !state.reading) stream.read(0)
              }
              Readable.prototype.pause = function () {
                  debug("call pause flowing=%j", this._readableState.flowing);
                  if (this._readableState.flowing !== false) {
                      debug("pause");
                      this._readableState.flowing = false;
                      this.emit("pause")
                  }
                  this._readableState.paused = true;
                  return this
              };

              function flow(stream) {
                  var state = stream._readableState;
                  debug("flow", state.flowing);
                  while (state.flowing && stream.read() !== null) {}
              }
              Readable.prototype.wrap = function (stream) {
                  var _this = this;
                  var state = this._readableState;
                  var paused = false;
                  stream.on("end", function () {
                      debug("wrapped end");
                      if (state.decoder && !state.ended) {
                          var chunk = state.decoder.end();
                          if (chunk && chunk.length) _this.push(chunk)
                      }
                      _this.push(null)
                  });
                  stream.on("data", function (chunk) {
                      debug("wrapped data");
                      if (state.decoder) chunk = state.decoder.write(chunk);
                      if (state.objectMode && (chunk === null || chunk === undefined)) return;
                      else if (!state.objectMode && (!chunk || !chunk.length)) return;
                      var ret = _this.push(chunk);
                      if (!ret) {
                          paused = true;
                          stream.pause()
                      }
                  });
                  for (var i in stream) {
                      if (this[i] === undefined && typeof stream[i] === "function") {
                          this[i] = function methodWrap(method) {
                              return function methodWrapReturnFunction() {
                                  return stream[method].apply(stream, arguments)
                              }
                          }(i)
                      }
                  }
                  for (var n = 0; n < kProxyEvents.length; n++) {
                      stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]))
                  }
                  this._read = function (n) {
                      debug("wrapped _read", n);
                      if (paused) {
                          paused = false;
                          stream.resume()
                      }
                  };
                  return this
              };
              if (typeof Symbol === "function") {
                  Readable.prototype[Symbol.asyncIterator] = function () {
                      if (createReadableStreamAsyncIterator === undefined) {
                          createReadableStreamAsyncIterator = require("./internal/streams/async_iterator")
                      }
                      return createReadableStreamAsyncIterator(this)
                  }
              }
              Object.defineProperty(Readable.prototype, "readableHighWaterMark", {
                  enumerable: false,
                  get: function get() {
                      return this._readableState.highWaterMark
                  }
              });
              Object.defineProperty(Readable.prototype, "readableBuffer", {
                  enumerable: false,
                  get: function get() {
                      return this._readableState && this._readableState.buffer
                  }
              });
              Object.defineProperty(Readable.prototype, "readableFlowing", {
                  enumerable: false,
                  get: function get() {
                      return this._readableState.flowing
                  },
                  set: function set(state) {
                      if (this._readableState) {
                          this._readableState.flowing = state
                      }
                  }
              });
              Readable._fromList = fromList;
              Object.defineProperty(Readable.prototype, "readableLength", {
                  enumerable: false,
                  get: function get() {
                      return this._readableState.length
                  }
              });

              function fromList(n, state) {
                  if (state.length === 0) return null;
                  var ret;
                  if (state.objectMode) ret = state.buffer.shift();
                  else if (!n || n >= state.length) {
                      if (state.decoder) ret = state.buffer.join("");
                      else if (state.buffer.length === 1) ret = state.buffer.first();
                      else ret = state.buffer.concat(state.length);
                      state.buffer.clear()
                  } else {
                      ret = state.buffer.consume(n, state.decoder)
                  }
                  return ret
              }

              function endReadable(stream) {
                  var state = stream._readableState;
                  debug("endReadable", state.endEmitted);
                  if (!state.endEmitted) {
                      state.ended = true;
                      process.nextTick(endReadableNT, state, stream)
                  }
              }

              function endReadableNT(state, stream) {
                  debug("endReadableNT", state.endEmitted, state.length);
                  if (!state.endEmitted && state.length === 0) {
                      state.endEmitted = true;
                      stream.readable = false;
                      stream.emit("end");
                      if (state.autoDestroy) {
                          var wState = stream._writableState;
                          if (!wState || wState.autoDestroy && wState.finished) {
                              stream.destroy()
                          }
                      }
                  }
              }
              if (typeof Symbol === "function") {
                  Readable.from = function (iterable, opts) {
                      if (from === undefined) {
                          from = require("./internal/streams/from")
                      }
                      return from(Readable, iterable, opts)
                  }
              }

              function indexOf(xs, x) {
                  for (var i = 0, l = xs.length; i < l; i++) {
                      if (xs[i] === x) return i
                  }
                  return -1
              }
          }).call(this)
      }).call(this, require("_process"), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  }, {
      "../errors": 37,
      "./_stream_duplex": 38,
      "./internal/streams/async_iterator": 43,
      "./internal/streams/buffer_list": 44,
      "./internal/streams/destroy": 45,
      "./internal/streams/from": 47,
      "./internal/streams/state": 49,
      "./internal/streams/stream": 50,
      _process: 36,
      buffer: 16,
      events: 20,
      inherits: 30,
      "string_decoder/": 53,
      util: 15
  }],
  41: [function (require, module, exports) {
      "use strict";
      module.exports = Transform;
      var _require$codes = require("../errors").codes,
          ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
          ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK,
          ERR_TRANSFORM_ALREADY_TRANSFORMING = _require$codes.ERR_TRANSFORM_ALREADY_TRANSFORMING,
          ERR_TRANSFORM_WITH_LENGTH_0 = _require$codes.ERR_TRANSFORM_WITH_LENGTH_0;
      var Duplex = require("./_stream_duplex");
      require("inherits")(Transform, Duplex);

      function afterTransform(er, data) {
          var ts = this._transformState;
          ts.transforming = false;
          var cb = ts.writecb;
          if (cb === null) {
              return this.emit("error", new ERR_MULTIPLE_CALLBACK)
          }
          ts.writechunk = null;
          ts.writecb = null;
          if (data != null) this.push(data);
          cb(er);
          var rs = this._readableState;
          rs.reading = false;
          if (rs.needReadable || rs.length < rs.highWaterMark) {
              this._read(rs.highWaterMark)
          }
      }

      function Transform(options) {
          if (!(this instanceof Transform)) return new Transform(options);
          Duplex.call(this, options);
          this._transformState = {
              afterTransform: afterTransform.bind(this),
              needTransform: false,
              transforming: false,
              writecb: null,
              writechunk: null,
              writeencoding: null
          };
          this._readableState.needReadable = true;
          this._readableState.sync = false;
          if (options) {
              if (typeof options.transform === "function") this._transform = options.transform;
              if (typeof options.flush === "function") this._flush = options.flush
          }
          this.on("prefinish", prefinish)
      }

      function prefinish() {
          var _this = this;
          if (typeof this._flush === "function" && !this._readableState.destroyed) {
              this._flush(function (er, data) {
                  done(_this, er, data)
              })
          } else {
              done(this, null, null)
          }
      }
      Transform.prototype.push = function (chunk, encoding) {
          this._transformState.needTransform = false;
          return Duplex.prototype.push.call(this, chunk, encoding)
      };
      Transform.prototype._transform = function (chunk, encoding, cb) {
          cb(new ERR_METHOD_NOT_IMPLEMENTED("_transform()"))
      };
      Transform.prototype._write = function (chunk, encoding, cb) {
          var ts = this._transformState;
          ts.writecb = cb;
          ts.writechunk = chunk;
          ts.writeencoding = encoding;
          if (!ts.transforming) {
              var rs = this._readableState;
              if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark)
          }
      };
      Transform.prototype._read = function (n) {
          var ts = this._transformState;
          if (ts.writechunk !== null && !ts.transforming) {
              ts.transforming = true;
              this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform)
          } else {
              ts.needTransform = true
          }
      };
      Transform.prototype._destroy = function (err, cb) {
          Duplex.prototype._destroy.call(this, err, function (err2) {
              cb(err2)
          })
      };

      function done(stream, er, data) {
          if (er) return stream.emit("error", er);
          if (data != null) stream.push(data);
          if (stream._writableState.length) throw new ERR_TRANSFORM_WITH_LENGTH_0;
          if (stream._transformState.transforming) throw new ERR_TRANSFORM_ALREADY_TRANSFORMING;
          return stream.push(null)
      }
  }, {
      "../errors": 37,
      "./_stream_duplex": 38,
      inherits: 30
  }],
  42: [function (require, module, exports) {
      (function (process, global) {
          (function () {
              "use strict";
              module.exports = Writable;

              function WriteReq(chunk, encoding, cb) {
                  this.chunk = chunk;
                  this.encoding = encoding;
                  this.callback = cb;
                  this.next = null
              }

              function CorkedRequest(state) {
                  var _this = this;
                  this.next = null;
                  this.entry = null;
                  this.finish = function () {
                      onCorkedFinish(_this, state)
                  }
              }
              var Duplex;
              Writable.WritableState = WritableState;
              var internalUtil = {
                  deprecate: require("util-deprecate")
              };
              var Stream = require("./internal/streams/stream");
              var Buffer = require("buffer").Buffer;
              var OurUint8Array = global.Uint8Array || function () {};

              function _uint8ArrayToBuffer(chunk) {
                  return Buffer.from(chunk)
              }

              function _isUint8Array(obj) {
                  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array
              }
              var destroyImpl = require("./internal/streams/destroy");
              var _require = require("./internal/streams/state"),
                  getHighWaterMark = _require.getHighWaterMark;
              var _require$codes = require("../errors").codes,
                  ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE,
                  ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
                  ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK,
                  ERR_STREAM_CANNOT_PIPE = _require$codes.ERR_STREAM_CANNOT_PIPE,
                  ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED,
                  ERR_STREAM_NULL_VALUES = _require$codes.ERR_STREAM_NULL_VALUES,
                  ERR_STREAM_WRITE_AFTER_END = _require$codes.ERR_STREAM_WRITE_AFTER_END,
                  ERR_UNKNOWN_ENCODING = _require$codes.ERR_UNKNOWN_ENCODING;
              var errorOrDestroy = destroyImpl.errorOrDestroy;
              require("inherits")(Writable, Stream);

              function nop() {}

              function WritableState(options, stream, isDuplex) {
                  Duplex = Duplex || require("./_stream_duplex");
                  options = options || {};
                  if (typeof isDuplex !== "boolean") isDuplex = stream instanceof Duplex;
                  this.objectMode = !!options.objectMode;
                  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
                  this.highWaterMark = getHighWaterMark(this, options, "writableHighWaterMark", isDuplex);
                  this.finalCalled = false;
                  this.needDrain = false;
                  this.ending = false;
                  this.ended = false;
                  this.finished = false;
                  this.destroyed = false;
                  var noDecode = options.decodeStrings === false;
                  this.decodeStrings = !noDecode;
                  this.defaultEncoding = options.defaultEncoding || "utf8";
                  this.length = 0;
                  this.writing = false;
                  this.corked = 0;
                  this.sync = true;
                  this.bufferProcessing = false;
                  this.onwrite = function (er) {
                      onwrite(stream, er)
                  };
                  this.writecb = null;
                  this.writelen = 0;
                  this.bufferedRequest = null;
                  this.lastBufferedRequest = null;
                  this.pendingcb = 0;
                  this.prefinished = false;
                  this.errorEmitted = false;
                  this.emitClose = options.emitClose !== false;
                  this.autoDestroy = !!options.autoDestroy;
                  this.bufferedRequestCount = 0;
                  this.corkedRequestsFree = new CorkedRequest(this)
              }
              WritableState.prototype.getBuffer = function getBuffer() {
                  var current = this.bufferedRequest;
                  var out = [];
                  while (current) {
                      out.push(current);
                      current = current.next
                  }
                  return out
              };
              (function () {
                  try {
                      Object.defineProperty(WritableState.prototype, "buffer", {
                          get: internalUtil.deprecate(function writableStateBufferGetter() {
                              return this.getBuffer()
                          }, "_writableState.buffer is deprecated. Use _writableState.getBuffer " + "instead.", "DEP0003")
                      })
                  } catch (_) {}
              })();
              var realHasInstance;
              if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
                  realHasInstance = Function.prototype[Symbol.hasInstance];
                  Object.defineProperty(Writable, Symbol.hasInstance, {
                      value: function value(object) {
                          if (realHasInstance.call(this, object)) return true;
                          if (this !== Writable) return false;
                          return object && object._writableState instanceof WritableState
                      }
                  })
              } else {
                  realHasInstance = function realHasInstance(object) {
                      return object instanceof this
                  }
              }

              function Writable(options) {
                  Duplex = Duplex || require("./_stream_duplex");
                  var isDuplex = this instanceof Duplex;
                  if (!isDuplex && !realHasInstance.call(Writable, this)) return new Writable(options);
                  this._writableState = new WritableState(options, this, isDuplex);
                  this.writable = true;
                  if (options) {
                      if (typeof options.write === "function") this._write = options.write;
                      if (typeof options.writev === "function") this._writev = options.writev;
                      if (typeof options.destroy === "function") this._destroy = options.destroy;
                      if (typeof options.final === "function") this._final = options.final
                  }
                  Stream.call(this)
              }
              Writable.prototype.pipe = function () {
                  errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE)
              };

              function writeAfterEnd(stream, cb) {
                  var er = new ERR_STREAM_WRITE_AFTER_END;
                  errorOrDestroy(stream, er);
                  process.nextTick(cb, er)
              }

              function validChunk(stream, state, chunk, cb) {
                  var er;
                  if (chunk === null) {
                      er = new ERR_STREAM_NULL_VALUES
                  } else if (typeof chunk !== "string" && !state.objectMode) {
                      er = new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer"], chunk)
                  }
                  if (er) {
                      errorOrDestroy(stream, er);
                      process.nextTick(cb, er);
                      return false
                  }
                  return true
              }
              Writable.prototype.write = function (chunk, encoding, cb) {
                  var state = this._writableState;
                  var ret = false;
                  var isBuf = !state.objectMode && _isUint8Array(chunk);
                  if (isBuf && !Buffer.isBuffer(chunk)) {
                      chunk = _uint8ArrayToBuffer(chunk)
                  }
                  if (typeof encoding === "function") {
                      cb = encoding;
                      encoding = null
                  }
                  if (isBuf) encoding = "buffer";
                  else if (!encoding) encoding = state.defaultEncoding;
                  if (typeof cb !== "function") cb = nop;
                  if (state.ending) writeAfterEnd(this, cb);
                  else if (isBuf || validChunk(this, state, chunk, cb)) {
                      state.pendingcb++;
                      ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb)
                  }
                  return ret
              };
              Writable.prototype.cork = function () {
                  this._writableState.corked++
              };
              Writable.prototype.uncork = function () {
                  var state = this._writableState;
                  if (state.corked) {
                      state.corked--;
                      if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state)
                  }
              };
              Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
                  if (typeof encoding === "string") encoding = encoding.toLowerCase();
                  if (!(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((encoding + "").toLowerCase()) > -1)) throw new ERR_UNKNOWN_ENCODING(encoding);
                  this._writableState.defaultEncoding = encoding;
                  return this
              };
              Object.defineProperty(Writable.prototype, "writableBuffer", {
                  enumerable: false,
                  get: function get() {
                      return this._writableState && this._writableState.getBuffer()
                  }
              });

              function decodeChunk(state, chunk, encoding) {
                  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === "string") {
                      chunk = Buffer.from(chunk, encoding)
                  }
                  return chunk
              }
              Object.defineProperty(Writable.prototype, "writableHighWaterMark", {
                  enumerable: false,
                  get: function get() {
                      return this._writableState.highWaterMark
                  }
              });

              function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
                  if (!isBuf) {
                      var newChunk = decodeChunk(state, chunk, encoding);
                      if (chunk !== newChunk) {
                          isBuf = true;
                          encoding = "buffer";
                          chunk = newChunk
                      }
                  }
                  var len = state.objectMode ? 1 : chunk.length;
                  state.length += len;
                  var ret = state.length < state.highWaterMark;
                  if (!ret) state.needDrain = true;
                  if (state.writing || state.corked) {
                      var last = state.lastBufferedRequest;
                      state.lastBufferedRequest = {
                          chunk: chunk,
                          encoding: encoding,
                          isBuf: isBuf,
                          callback: cb,
                          next: null
                      };
                      if (last) {
                          last.next = state.lastBufferedRequest
                      } else {
                          state.bufferedRequest = state.lastBufferedRequest
                      }
                      state.bufferedRequestCount += 1
                  } else {
                      doWrite(stream, state, false, len, chunk, encoding, cb)
                  }
                  return ret
              }

              function doWrite(stream, state, writev, len, chunk, encoding, cb) {
                  state.writelen = len;
                  state.writecb = cb;
                  state.writing = true;
                  state.sync = true;
                  if (state.destroyed) state.onwrite(new ERR_STREAM_DESTROYED("write"));
                  else if (writev) stream._writev(chunk, state.onwrite);
                  else stream._write(chunk, encoding, state.onwrite);
                  state.sync = false
              }

              function onwriteError(stream, state, sync, er, cb) {
                  --state.pendingcb;
                  if (sync) {
                      process.nextTick(cb, er);
                      process.nextTick(finishMaybe, stream, state);
                      stream._writableState.errorEmitted = true;
                      errorOrDestroy(stream, er)
                  } else {
                      cb(er);
                      stream._writableState.errorEmitted = true;
                      errorOrDestroy(stream, er);
                      finishMaybe(stream, state)
                  }
              }

              function onwriteStateUpdate(state) {
                  state.writing = false;
                  state.writecb = null;
                  state.length -= state.writelen;
                  state.writelen = 0
              }

              function onwrite(stream, er) {
                  var state = stream._writableState;
                  var sync = state.sync;
                  var cb = state.writecb;
                  if (typeof cb !== "function") throw new ERR_MULTIPLE_CALLBACK;
                  onwriteStateUpdate(state);
                  if (er) onwriteError(stream, state, sync, er, cb);
                  else {
                      var finished = needFinish(state) || stream.destroyed;
                      if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
                          clearBuffer(stream, state)
                      }
                      if (sync) {
                          process.nextTick(afterWrite, stream, state, finished, cb)
                      } else {
                          afterWrite(stream, state, finished, cb)
                      }
                  }
              }

              function afterWrite(stream, state, finished, cb) {
                  if (!finished) onwriteDrain(stream, state);
                  state.pendingcb--;
                  cb();
                  finishMaybe(stream, state)
              }

              function onwriteDrain(stream, state) {
                  if (state.length === 0 && state.needDrain) {
                      state.needDrain = false;
                      stream.emit("drain")
                  }
              }

              function clearBuffer(stream, state) {
                  state.bufferProcessing = true;
                  var entry = state.bufferedRequest;
                  if (stream._writev && entry && entry.next) {
                      var l = state.bufferedRequestCount;
                      var buffer = new Array(l);
                      var holder = state.corkedRequestsFree;
                      holder.entry = entry;
                      var count = 0;
                      var allBuffers = true;
                      while (entry) {
                          buffer[count] = entry;
                          if (!entry.isBuf) allBuffers = false;
                          entry = entry.next;
                          count += 1
                      }
                      buffer.allBuffers = allBuffers;
                      doWrite(stream, state, true, state.length, buffer, "", holder.finish);
                      state.pendingcb++;
                      state.lastBufferedRequest = null;
                      if (holder.next) {
                          state.corkedRequestsFree = holder.next;
                          holder.next = null
                      } else {
                          state.corkedRequestsFree = new CorkedRequest(state)
                      }
                      state.bufferedRequestCount = 0
                  } else {
                      while (entry) {
                          var chunk = entry.chunk;
                          var encoding = entry.encoding;
                          var cb = entry.callback;
                          var len = state.objectMode ? 1 : chunk.length;
                          doWrite(stream, state, false, len, chunk, encoding, cb);
                          entry = entry.next;
                          state.bufferedRequestCount--;
                          if (state.writing) {
                              break
                          }
                      }
                      if (entry === null) state.lastBufferedRequest = null
                  }
                  state.bufferedRequest = entry;
                  state.bufferProcessing = false
              }
              Writable.prototype._write = function (chunk, encoding, cb) {
                  cb(new ERR_METHOD_NOT_IMPLEMENTED("_write()"))
              };
              Writable.prototype._writev = null;
              Writable.prototype.end = function (chunk, encoding, cb) {
                  var state = this._writableState;
                  if (typeof chunk === "function") {
                      cb = chunk;
                      chunk = null;
                      encoding = null
                  } else if (typeof encoding === "function") {
                      cb = encoding;
                      encoding = null
                  }
                  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);
                  if (state.corked) {
                      state.corked = 1;
                      this.uncork()
                  }
                  if (!state.ending) endWritable(this, state, cb);
                  return this
              };
              Object.defineProperty(Writable.prototype, "writableLength", {
                  enumerable: false,
                  get: function get() {
                      return this._writableState.length
                  }
              });

              function needFinish(state) {
                  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing
              }

              function callFinal(stream, state) {
                  stream._final(function (err) {
                      state.pendingcb--;
                      if (err) {
                          errorOrDestroy(stream, err)
                      }
                      state.prefinished = true;
                      stream.emit("prefinish");
                      finishMaybe(stream, state)
                  })
              }

              function prefinish(stream, state) {
                  if (!state.prefinished && !state.finalCalled) {
                      if (typeof stream._final === "function" && !state.destroyed) {
                          state.pendingcb++;
                          state.finalCalled = true;
                          process.nextTick(callFinal, stream, state)
                      } else {
                          state.prefinished = true;
                          stream.emit("prefinish")
                      }
                  }
              }

              function finishMaybe(stream, state) {
                  var need = needFinish(state);
                  if (need) {
                      prefinish(stream, state);
                      if (state.pendingcb === 0) {
                          state.finished = true;
                          stream.emit("finish");
                          if (state.autoDestroy) {
                              var rState = stream._readableState;
                              if (!rState || rState.autoDestroy && rState.endEmitted) {
                                  stream.destroy()
                              }
                          }
                      }
                  }
                  return need
              }

              function endWritable(stream, state, cb) {
                  state.ending = true;
                  finishMaybe(stream, state);
                  if (cb) {
                      if (state.finished) process.nextTick(cb);
                      else stream.once("finish", cb)
                  }
                  state.ended = true;
                  stream.writable = false
              }

              function onCorkedFinish(corkReq, state, err) {
                  var entry = corkReq.entry;
                  corkReq.entry = null;
                  while (entry) {
                      var cb = entry.callback;
                      state.pendingcb--;
                      cb(err);
                      entry = entry.next
                  }
                  state.corkedRequestsFree.next = corkReq
              }
              Object.defineProperty(Writable.prototype, "destroyed", {
                  enumerable: false,
                  get: function get() {
                      if (this._writableState === undefined) {
                          return false
                      }
                      return this._writableState.destroyed
                  },
                  set: function set(value) {
                      if (!this._writableState) {
                          return
                      }
                      this._writableState.destroyed = value
                  }
              });
              Writable.prototype.destroy = destroyImpl.destroy;
              Writable.prototype._undestroy = destroyImpl.undestroy;
              Writable.prototype._destroy = function (err, cb) {
                  cb(err)
              }
          }).call(this)
      }).call(this, require("_process"), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  }, {
      "../errors": 37,
      "./_stream_duplex": 38,
      "./internal/streams/destroy": 45,
      "./internal/streams/state": 49,
      "./internal/streams/stream": 50,
      _process: 36,
      buffer: 16,
      inherits: 30,
      "util-deprecate": 55
  }],
  43: [function (require, module, exports) {
      (function (process) {
          (function () {
              "use strict";
              var _Object$setPrototypeO;

              function _defineProperty(obj, key, value) {
                  if (key in obj) {
                      Object.defineProperty(obj, key, {
                          value: value,
                          enumerable: true,
                          configurable: true,
                          writable: true
                      })
                  } else {
                      obj[key] = value
                  }
                  return obj
              }
              var finished = require("./end-of-stream");
              var kLastResolve = Symbol("lastResolve");
              var kLastReject = Symbol("lastReject");
              var kError = Symbol("error");
              var kEnded = Symbol("ended");
              var kLastPromise = Symbol("lastPromise");
              var kHandlePromise = Symbol("handlePromise");
              var kStream = Symbol("stream");

              function createIterResult(value, done) {
                  return {
                      value: value,
                      done: done
                  }
              }

              function readAndResolve(iter) {
                  var resolve = iter[kLastResolve];
                  if (resolve !== null) {
                      var data = iter[kStream].read();
                      if (data !== null) {
                          iter[kLastPromise] = null;
                          iter[kLastResolve] = null;
                          iter[kLastReject] = null;
                          resolve(createIterResult(data, false))
                      }
                  }
              }

              function onReadable(iter) {
                  process.nextTick(readAndResolve, iter)
              }

              function wrapForNext(lastPromise, iter) {
                  return function (resolve, reject) {
                      lastPromise.then(function () {
                          if (iter[kEnded]) {
                              resolve(createIterResult(undefined, true));
                              return
                          }
                          iter[kHandlePromise](resolve, reject)
                      }, reject)
                  }
              }
              var AsyncIteratorPrototype = Object.getPrototypeOf(function () {});
              var ReadableStreamAsyncIteratorPrototype = Object.setPrototypeOf((_Object$setPrototypeO = {
                  get stream() {
                      return this[kStream]
                  },
                  next: function next() {
                      var _this = this;
                      var error = this[kError];
                      if (error !== null) {
                          return Promise.reject(error)
                      }
                      if (this[kEnded]) {
                          return Promise.resolve(createIterResult(undefined, true))
                      }
                      if (this[kStream].destroyed) {
                          return new Promise(function (resolve, reject) {
                              process.nextTick(function () {
                                  if (_this[kError]) {
                                      reject(_this[kError])
                                  } else {
                                      resolve(createIterResult(undefined, true))
                                  }
                              })
                          })
                      }
                      var lastPromise = this[kLastPromise];
                      var promise;
                      if (lastPromise) {
                          promise = new Promise(wrapForNext(lastPromise, this))
                      } else {
                          var data = this[kStream].read();
                          if (data !== null) {
                              return Promise.resolve(createIterResult(data, false))
                          }
                          promise = new Promise(this[kHandlePromise])
                      }
                      this[kLastPromise] = promise;
                      return promise
                  }
              }, _defineProperty(_Object$setPrototypeO, Symbol.asyncIterator, function () {
                  return this
              }), _defineProperty(_Object$setPrototypeO, "return", function _return() {
                  var _this2 = this;
                  return new Promise(function (resolve, reject) {
                      _this2[kStream].destroy(null, function (err) {
                          if (err) {
                              reject(err);
                              return
                          }
                          resolve(createIterResult(undefined, true))
                      })
                  })
              }), _Object$setPrototypeO), AsyncIteratorPrototype);
              var createReadableStreamAsyncIterator = function createReadableStreamAsyncIterator(stream) {
                  var _Object$create;
                  var iterator = Object.create(ReadableStreamAsyncIteratorPrototype, (_Object$create = {}, _defineProperty(_Object$create, kStream, {
                      value: stream,
                      writable: true
                  }), _defineProperty(_Object$create, kLastResolve, {
                      value: null,
                      writable: true
                  }), _defineProperty(_Object$create, kLastReject, {
                      value: null,
                      writable: true
                  }), _defineProperty(_Object$create, kError, {
                      value: null,
                      writable: true
                  }), _defineProperty(_Object$create, kEnded, {
                      value: stream._readableState.endEmitted,
                      writable: true
                  }), _defineProperty(_Object$create, kHandlePromise, {
                      value: function value(resolve, reject) {
                          var data = iterator[kStream].read();
                          if (data) {
                              iterator[kLastPromise] = null;
                              iterator[kLastResolve] = null;
                              iterator[kLastReject] = null;
                              resolve(createIterResult(data, false))
                          } else {
                              iterator[kLastResolve] = resolve;
                              iterator[kLastReject] = reject
                          }
                      },
                      writable: true
                  }), _Object$create));
                  iterator[kLastPromise] = null;
                  finished(stream, function (err) {
                      if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
                          var reject = iterator[kLastReject];
                          if (reject !== null) {
                              iterator[kLastPromise] = null;
                              iterator[kLastResolve] = null;
                              iterator[kLastReject] = null;
                              reject(err)
                          }
                          iterator[kError] = err;
                          return
                      }
                      var resolve = iterator[kLastResolve];
                      if (resolve !== null) {
                          iterator[kLastPromise] = null;
                          iterator[kLastResolve] = null;
                          iterator[kLastReject] = null;
                          resolve(createIterResult(undefined, true))
                      }
                      iterator[kEnded] = true
                  });
                  stream.on("readable", onReadable.bind(null, iterator));
                  return iterator
              };
              module.exports = createReadableStreamAsyncIterator
          }).call(this)
      }).call(this, require("_process"))
  }, {
      "./end-of-stream": 46,
      _process: 36
  }],
  44: [function (require, module, exports) {
      "use strict";

      function ownKeys(object, enumerableOnly) {
          var keys = Object.keys(object);
          if (Object.getOwnPropertySymbols) {
              var symbols = Object.getOwnPropertySymbols(object);
              if (enumerableOnly) symbols = symbols.filter(function (sym) {
                  return Object.getOwnPropertyDescriptor(object, sym).enumerable
              });
              keys.push.apply(keys, symbols)
          }
          return keys
      }

      function _objectSpread(target) {
          for (var i = 1; i < arguments.length; i++) {
              var source = arguments[i] != null ? arguments[i] : {};
              if (i % 2) {
                  ownKeys(Object(source), true).forEach(function (key) {
                      _defineProperty(target, key, source[key])
                  })
              } else if (Object.getOwnPropertyDescriptors) {
                  Object.defineProperties(target, Object.getOwnPropertyDescriptors(source))
              } else {
                  ownKeys(Object(source)).forEach(function (key) {
                      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key))
                  })
              }
          }
          return target
      }

      function _defineProperty(obj, key, value) {
          if (key in obj) {
              Object.defineProperty(obj, key, {
                  value: value,
                  enumerable: true,
                  configurable: true,
                  writable: true
              })
          } else {
              obj[key] = value
          }
          return obj
      }

      function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function")
          }
      }

      function _defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
              var descriptor = props[i];
              descriptor.enumerable = descriptor.enumerable || false;
              descriptor.configurable = true;
              if ("value" in descriptor) descriptor.writable = true;
              Object.defineProperty(target, descriptor.key, descriptor)
          }
      }

      function _createClass(Constructor, protoProps, staticProps) {
          if (protoProps) _defineProperties(Constructor.prototype, protoProps);
          if (staticProps) _defineProperties(Constructor, staticProps);
          return Constructor
      }
      var _require = require("buffer"),
          Buffer = _require.Buffer;
      var _require2 = require("util"),
          inspect = _require2.inspect;
      var custom = inspect && inspect.custom || "inspect";

      function copyBuffer(src, target, offset) {
          Buffer.prototype.copy.call(src, target, offset)
      }
      module.exports = function () {
          function BufferList() {
              _classCallCheck(this, BufferList);
              this.head = null;
              this.tail = null;
              this.length = 0
          }
          _createClass(BufferList, [{
              key: "push",
              value: function push(v) {
                  var entry = {
                      data: v,
                      next: null
                  };
                  if (this.length > 0) this.tail.next = entry;
                  else this.head = entry;
                  this.tail = entry;
                  ++this.length
              }
          }, {
              key: "unshift",
              value: function unshift(v) {
                  var entry = {
                      data: v,
                      next: this.head
                  };
                  if (this.length === 0) this.tail = entry;
                  this.head = entry;
                  ++this.length
              }
          }, {
              key: "shift",
              value: function shift() {
                  if (this.length === 0) return;
                  var ret = this.head.data;
                  if (this.length === 1) this.head = this.tail = null;
                  else this.head = this.head.next;
                  --this.length;
                  return ret
              }
          }, {
              key: "clear",
              value: function clear() {
                  this.head = this.tail = null;
                  this.length = 0
              }
          }, {
              key: "join",
              value: function join(s) {
                  if (this.length === 0) return "";
                  var p = this.head;
                  var ret = "" + p.data;
                  while (p = p.next) {
                      ret += s + p.data
                  }
                  return ret
              }
          }, {
              key: "concat",
              value: function concat(n) {
                  if (this.length === 0) return Buffer.alloc(0);
                  var ret = Buffer.allocUnsafe(n >>> 0);
                  var p = this.head;
                  var i = 0;
                  while (p) {
                      copyBuffer(p.data, ret, i);
                      i += p.data.length;
                      p = p.next
                  }
                  return ret
              }
          }, {
              key: "consume",
              value: function consume(n, hasStrings) {
                  var ret;
                  if (n < this.head.data.length) {
                      ret = this.head.data.slice(0, n);
                      this.head.data = this.head.data.slice(n)
                  } else if (n === this.head.data.length) {
                      ret = this.shift()
                  } else {
                      ret = hasStrings ? this._getString(n) : this._getBuffer(n)
                  }
                  return ret
              }
          }, {
              key: "first",
              value: function first() {
                  return this.head.data
              }
          }, {
              key: "_getString",
              value: function _getString(n) {
                  var p = this.head;
                  var c = 1;
                  var ret = p.data;
                  n -= ret.length;
                  while (p = p.next) {
                      var str = p.data;
                      var nb = n > str.length ? str.length : n;
                      if (nb === str.length) ret += str;
                      else ret += str.slice(0, n);
                      n -= nb;
                      if (n === 0) {
                          if (nb === str.length) {
                              ++c;
                              if (p.next) this.head = p.next;
                              else this.head = this.tail = null
                          } else {
                              this.head = p;
                              p.data = str.slice(nb)
                          }
                          break
                      }++c
                  }
                  this.length -= c;
                  return ret
              }
          }, {
              key: "_getBuffer",
              value: function _getBuffer(n) {
                  var ret = Buffer.allocUnsafe(n);
                  var p = this.head;
                  var c = 1;
                  p.data.copy(ret);
                  n -= p.data.length;
                  while (p = p.next) {
                      var buf = p.data;
                      var nb = n > buf.length ? buf.length : n;
                      buf.copy(ret, ret.length - n, 0, nb);
                      n -= nb;
                      if (n === 0) {
                          if (nb === buf.length) {
                              ++c;
                              if (p.next) this.head = p.next;
                              else this.head = this.tail = null
                          } else {
                              this.head = p;
                              p.data = buf.slice(nb)
                          }
                          break
                      }++c
                  }
                  this.length -= c;
                  return ret
              }
          }, {
              key: custom,
              value: function value(_, options) {
                  return inspect(this, _objectSpread({}, options, {
                      depth: 0,
                      customInspect: false
                  }))
              }
          }]);
          return BufferList
      }()
  }, {
      buffer: 16,
      util: 15
  }],
  45: [function (require, module, exports) {
      (function (process) {
          (function () {
              "use strict";

              function destroy(err, cb) {
                  var _this = this;
                  var readableDestroyed = this._readableState && this._readableState.destroyed;
                  var writableDestroyed = this._writableState && this._writableState.destroyed;
                  if (readableDestroyed || writableDestroyed) {
                      if (cb) {
                          cb(err)
                      } else if (err) {
                          if (!this._writableState) {
                              process.nextTick(emitErrorNT, this, err)
                          } else if (!this._writableState.errorEmitted) {
                              this._writableState.errorEmitted = true;
                              process.nextTick(emitErrorNT, this, err)
                          }
                      }
                      return this
                  }
                  if (this._readableState) {
                      this._readableState.destroyed = true
                  }
                  if (this._writableState) {
                      this._writableState.destroyed = true
                  }
                  this._destroy(err || null, function (err) {
                      if (!cb && err) {
                          if (!_this._writableState) {
                              process.nextTick(emitErrorAndCloseNT, _this, err)
                          } else if (!_this._writableState.errorEmitted) {
                              _this._writableState.errorEmitted = true;
                              process.nextTick(emitErrorAndCloseNT, _this, err)
                          } else {
                              process.nextTick(emitCloseNT, _this)
                          }
                      } else if (cb) {
                          process.nextTick(emitCloseNT, _this);
                          cb(err)
                      } else {
                          process.nextTick(emitCloseNT, _this)
                      }
                  });
                  return this
              }

              function emitErrorAndCloseNT(self, err) {
                  emitErrorNT(self, err);
                  emitCloseNT(self)
              }

              function emitCloseNT(self) {
                  if (self._writableState && !self._writableState.emitClose) return;
                  if (self._readableState && !self._readableState.emitClose) return;
                  self.emit("close")
              }

              function undestroy() {
                  if (this._readableState) {
                      this._readableState.destroyed = false;
                      this._readableState.reading = false;
                      this._readableState.ended = false;
                      this._readableState.endEmitted = false
                  }
                  if (this._writableState) {
                      this._writableState.destroyed = false;
                      this._writableState.ended = false;
                      this._writableState.ending = false;
                      this._writableState.finalCalled = false;
                      this._writableState.prefinished = false;
                      this._writableState.finished = false;
                      this._writableState.errorEmitted = false
                  }
              }

              function emitErrorNT(self, err) {
                  self.emit("error", err)
              }

              function errorOrDestroy(stream, err) {
                  var rState = stream._readableState;
                  var wState = stream._writableState;
                  if (rState && rState.autoDestroy || wState && wState.autoDestroy) stream.destroy(err);
                  else stream.emit("error", err)
              }
              module.exports = {
                  destroy: destroy,
                  undestroy: undestroy,
                  errorOrDestroy: errorOrDestroy
              }
          }).call(this)
      }).call(this, require("_process"))
  }, {
      _process: 36
  }],
  46: [function (require, module, exports) {
      "use strict";
      var ERR_STREAM_PREMATURE_CLOSE = require("../../../errors").codes.ERR_STREAM_PREMATURE_CLOSE;

      function once(callback) {
          var called = false;
          return function () {
              if (called) return;
              called = true;
              for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
                  args[_key] = arguments[_key]
              }
              callback.apply(this, args)
          }
      }

      function noop() {}

      function isRequest(stream) {
          return stream.setHeader && typeof stream.abort === "function"
      }

      function eos(stream, opts, callback) {
          if (typeof opts === "function") return eos(stream, null, opts);
          if (!opts) opts = {};
          callback = once(callback || noop);
          var readable = opts.readable || opts.readable !== false && stream.readable;
          var writable = opts.writable || opts.writable !== false && stream.writable;
          var onlegacyfinish = function onlegacyfinish() {
              if (!stream.writable) onfinish()
          };
          var writableEnded = stream._writableState && stream._writableState.finished;
          var onfinish = function onfinish() {
              writable = false;
              writableEnded = true;
              if (!readable) callback.call(stream)
          };
          var readableEnded = stream._readableState && stream._readableState.endEmitted;
          var onend = function onend() {
              readable = false;
              readableEnded = true;
              if (!writable) callback.call(stream)
          };
          var onerror = function onerror(err) {
              callback.call(stream, err)
          };
          var onclose = function onclose() {
              var err;
              if (readable && !readableEnded) {
                  if (!stream._readableState || !stream._readableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE;
                  return callback.call(stream, err)
              }
              if (writable && !writableEnded) {
                  if (!stream._writableState || !stream._writableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE;
                  return callback.call(stream, err)
              }
          };
          var onrequest = function onrequest() {
              stream.req.on("finish", onfinish)
          };
          if (isRequest(stream)) {
              stream.on("complete", onfinish);
              stream.on("abort", onclose);
              if (stream.req) onrequest();
              else stream.on("request", onrequest)
          } else if (writable && !stream._writableState) {
              stream.on("end", onlegacyfinish);
              stream.on("close", onlegacyfinish)
          }
          stream.on("end", onend);
          stream.on("finish", onfinish);
          if (opts.error !== false) stream.on("error", onerror);
          stream.on("close", onclose);
          return function () {
              stream.removeListener("complete", onfinish);
              stream.removeListener("abort", onclose);
              stream.removeListener("request", onrequest);
              if (stream.req) stream.req.removeListener("finish", onfinish);
              stream.removeListener("end", onlegacyfinish);
              stream.removeListener("close", onlegacyfinish);
              stream.removeListener("finish", onfinish);
              stream.removeListener("end", onend);
              stream.removeListener("error", onerror);
              stream.removeListener("close", onclose)
          }
      }
      module.exports = eos
  }, {
      "../../../errors": 37
  }],
  47: [function (require, module, exports) {
      module.exports = function () {
          throw new Error("Readable.from is not available in the browser")
      }
  }, {}],
  48: [function (require, module, exports) {
      "use strict";
      var eos;

      function once(callback) {
          var called = false;
          return function () {
              if (called) return;
              called = true;
              callback.apply(void 0, arguments)
          }
      }
      var _require$codes = require("../../../errors").codes,
          ERR_MISSING_ARGS = _require$codes.ERR_MISSING_ARGS,
          ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED;

      function noop(err) {
          if (err) throw err
      }

      function isRequest(stream) {
          return stream.setHeader && typeof stream.abort === "function"
      }

      function destroyer(stream, reading, writing, callback) {
          callback = once(callback);
          var closed = false;
          stream.on("close", function () {
              closed = true
          });
          if (eos === undefined) eos = require("./end-of-stream");
          eos(stream, {
              readable: reading,
              writable: writing
          }, function (err) {
              if (err) return callback(err);
              closed = true;
              callback()
          });
          var destroyed = false;
          return function (err) {
              if (closed) return;
              if (destroyed) return;
              destroyed = true;
              if (isRequest(stream)) return stream.abort();
              if (typeof stream.destroy === "function") return stream.destroy();
              callback(err || new ERR_STREAM_DESTROYED("pipe"))
          }
      }

      function call(fn) {
          fn()
      }

      function pipe(from, to) {
          return from.pipe(to)
      }

      function popCallback(streams) {
          if (!streams.length) return noop;
          if (typeof streams[streams.length - 1] !== "function") return noop;
          return streams.pop()
      }

      function pipeline() {
          for (var _len = arguments.length, streams = new Array(_len), _key = 0; _key < _len; _key++) {
              streams[_key] = arguments[_key]
          }
          var callback = popCallback(streams);
          if (Array.isArray(streams[0])) streams = streams[0];
          if (streams.length < 2) {
              throw new ERR_MISSING_ARGS("streams")
          }
          var error;
          var destroys = streams.map(function (stream, i) {
              var reading = i < streams.length - 1;
              var writing = i > 0;
              return destroyer(stream, reading, writing, function (err) {
                  if (!error) error = err;
                  if (err) destroys.forEach(call);
                  if (reading) return;
                  destroys.forEach(call);
                  callback(error)
              })
          });
          return streams.reduce(pipe)
      }
      module.exports = pipeline
  }, {
      "../../../errors": 37,
      "./end-of-stream": 46
  }],
  49: [function (require, module, exports) {
      "use strict";
      var ERR_INVALID_OPT_VALUE = require("../../../errors").codes.ERR_INVALID_OPT_VALUE;

      function highWaterMarkFrom(options, isDuplex, duplexKey) {
          return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null
      }

      function getHighWaterMark(state, options, duplexKey, isDuplex) {
          var hwm = highWaterMarkFrom(options, isDuplex, duplexKey);
          if (hwm != null) {
              if (!(isFinite(hwm) && Math.floor(hwm) === hwm) || hwm < 0) {
                  var name = isDuplex ? duplexKey : "highWaterMark";
                  throw new ERR_INVALID_OPT_VALUE(name, hwm)
              }
              return Math.floor(hwm)
          }
          return state.objectMode ? 16 : 16 * 1024
      }
      module.exports = {
          getHighWaterMark: getHighWaterMark
      }
  }, {
      "../../../errors": 37
  }],
  50: [function (require, module, exports) {
      module.exports = require("events").EventEmitter
  }, {
      events: 20
  }],
  51: [function (require, module, exports) {
      exports = module.exports = require("./lib/_stream_readable.js");
      exports.Stream = exports;
      exports.Readable = exports;
      exports.Writable = require("./lib/_stream_writable.js");
      exports.Duplex = require("./lib/_stream_duplex.js");
      exports.Transform = require("./lib/_stream_transform.js");
      exports.PassThrough = require("./lib/_stream_passthrough.js");
      exports.finished = require("./lib/internal/streams/end-of-stream.js");
      exports.pipeline = require("./lib/internal/streams/pipeline.js")
  }, {
      "./lib/_stream_duplex.js": 38,
      "./lib/_stream_passthrough.js": 39,
      "./lib/_stream_readable.js": 40,
      "./lib/_stream_transform.js": 41,
      "./lib/_stream_writable.js": 42,
      "./lib/internal/streams/end-of-stream.js": 46,
      "./lib/internal/streams/pipeline.js": 48
  }],
  52: [function (require, module, exports) {
      var buffer = require("buffer");
      var Buffer = buffer.Buffer;

      function copyProps(src, dst) {
          for (var key in src) {
              dst[key] = src[key]
          }
      }
      if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
          module.exports = buffer
      } else {
          copyProps(buffer, exports);
          exports.Buffer = SafeBuffer
      }

      function SafeBuffer(arg, encodingOrOffset, length) {
          return Buffer(arg, encodingOrOffset, length)
      }
      SafeBuffer.prototype = Object.create(Buffer.prototype);
      copyProps(Buffer, SafeBuffer);
      SafeBuffer.from = function (arg, encodingOrOffset, length) {
          if (typeof arg === "number") {
              throw new TypeError("Argument must not be a number")
          }
          return Buffer(arg, encodingOrOffset, length)
      };
      SafeBuffer.alloc = function (size, fill, encoding) {
          if (typeof size !== "number") {
              throw new TypeError("Argument must be a number")
          }
          var buf = Buffer(size);
          if (fill !== undefined) {
              if (typeof encoding === "string") {
                  buf.fill(fill, encoding)
              } else {
                  buf.fill(fill)
              }
          } else {
              buf.fill(0)
          }
          return buf
      };
      SafeBuffer.allocUnsafe = function (size) {
          if (typeof size !== "number") {
              throw new TypeError("Argument must be a number")
          }
          return Buffer(size)
      };
      SafeBuffer.allocUnsafeSlow = function (size) {
          if (typeof size !== "number") {
              throw new TypeError("Argument must be a number")
          }
          return buffer.SlowBuffer(size)
      }
  }, {
      buffer: 16
  }],
  53: [function (require, module, exports) {
      "use strict";
      var Buffer = require("safe-buffer").Buffer;
      var isEncoding = Buffer.isEncoding || function (encoding) {
          encoding = "" + encoding;
          switch (encoding && encoding.toLowerCase()) {
              case "hex":
              case "utf8":
              case "utf-8":
              case "ascii":
              case "binary":
              case "base64":
              case "ucs2":
              case "ucs-2":
              case "utf16le":
              case "utf-16le":
              case "raw":
                  return true;
              default:
                  return false
          }
      };

      function _normalizeEncoding(enc) {
          if (!enc) return "utf8";
          var retried;
          while (true) {
              switch (enc) {
                  case "utf8":
                  case "utf-8":
                      return "utf8";
                  case "ucs2":
                  case "ucs-2":
                  case "utf16le":
                  case "utf-16le":
                      return "utf16le";
                  case "latin1":
                  case "binary":
                      return "latin1";
                  case "base64":
                  case "ascii":
                  case "hex":
                      return enc;
                  default:
                      if (retried) return;
                      enc = ("" + enc).toLowerCase();
                      retried = true
              }
          }
      }

      function normalizeEncoding(enc) {
          var nenc = _normalizeEncoding(enc);
          if (typeof nenc !== "string" && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
          return nenc || enc
      }
      exports.StringDecoder = StringDecoder;

      function StringDecoder(encoding) {
          this.encoding = normalizeEncoding(encoding);
          var nb;
          switch (this.encoding) {
              case "utf16le":
                  this.text = utf16Text;
                  this.end = utf16End;
                  nb = 4;
                  break;
              case "utf8":
                  this.fillLast = utf8FillLast;
                  nb = 4;
                  break;
              case "base64":
                  this.text = base64Text;
                  this.end = base64End;
                  nb = 3;
                  break;
              default:
                  this.write = simpleWrite;
                  this.end = simpleEnd;
                  return
          }
          this.lastNeed = 0;
          this.lastTotal = 0;
          this.lastChar = Buffer.allocUnsafe(nb)
      }
      StringDecoder.prototype.write = function (buf) {
          if (buf.length === 0) return "";
          var r;
          var i;
          if (this.lastNeed) {
              r = this.fillLast(buf);
              if (r === undefined) return "";
              i = this.lastNeed;
              this.lastNeed = 0
          } else {
              i = 0
          }
          if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
          return r || ""
      };
      StringDecoder.prototype.end = utf8End;
      StringDecoder.prototype.text = utf8Text;
      StringDecoder.prototype.fillLast = function (buf) {
          if (this.lastNeed <= buf.length) {
              buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
              return this.lastChar.toString(this.encoding, 0, this.lastTotal)
          }
          buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
          this.lastNeed -= buf.length
      };

      function utf8CheckByte(byte) {
          if (byte <= 127) return 0;
          else if (byte >> 5 === 6) return 2;
          else if (byte >> 4 === 14) return 3;
          else if (byte >> 3 === 30) return 4;
          return byte >> 6 === 2 ? -1 : -2
      }

      function utf8CheckIncomplete(self, buf, i) {
          var j = buf.length - 1;
          if (j < i) return 0;
          var nb = utf8CheckByte(buf[j]);
          if (nb >= 0) {
              if (nb > 0) self.lastNeed = nb - 1;
              return nb
          }
          if (--j < i || nb === -2) return 0;
          nb = utf8CheckByte(buf[j]);
          if (nb >= 0) {
              if (nb > 0) self.lastNeed = nb - 2;
              return nb
          }
          if (--j < i || nb === -2) return 0;
          nb = utf8CheckByte(buf[j]);
          if (nb >= 0) {
              if (nb > 0) {
                  if (nb === 2) nb = 0;
                  else self.lastNeed = nb - 3
              }
              return nb
          }
          return 0
      }

      function utf8CheckExtraBytes(self, buf, p) {
          if ((buf[0] & 192) !== 128) {
              self.lastNeed = 0;
              return "�"
          }
          if (self.lastNeed > 1 && buf.length > 1) {
              if ((buf[1] & 192) !== 128) {
                  self.lastNeed = 1;
                  return "�"
              }
              if (self.lastNeed > 2 && buf.length > 2) {
                  if ((buf[2] & 192) !== 128) {
                      self.lastNeed = 2;
                      return "�"
                  }
              }
          }
      }

      function utf8FillLast(buf) {
          var p = this.lastTotal - this.lastNeed;
          var r = utf8CheckExtraBytes(this, buf, p);
          if (r !== undefined) return r;
          if (this.lastNeed <= buf.length) {
              buf.copy(this.lastChar, p, 0, this.lastNeed);
              return this.lastChar.toString(this.encoding, 0, this.lastTotal)
          }
          buf.copy(this.lastChar, p, 0, buf.length);
          this.lastNeed -= buf.length
      }

      function utf8Text(buf, i) {
          var total = utf8CheckIncomplete(this, buf, i);
          if (!this.lastNeed) return buf.toString("utf8", i);
          this.lastTotal = total;
          var end = buf.length - (total - this.lastNeed);
          buf.copy(this.lastChar, 0, end);
          return buf.toString("utf8", i, end)
      }

      function utf8End(buf) {
          var r = buf && buf.length ? this.write(buf) : "";
          if (this.lastNeed) return r + "�";
          return r
      }

      function utf16Text(buf, i) {
          if ((buf.length - i) % 2 === 0) {
              var r = buf.toString("utf16le", i);
              if (r) {
                  var c = r.charCodeAt(r.length - 1);
                  if (c >= 55296 && c <= 56319) {
                      this.lastNeed = 2;
                      this.lastTotal = 4;
                      this.lastChar[0] = buf[buf.length - 2];
                      this.lastChar[1] = buf[buf.length - 1];
                      return r.slice(0, -1)
                  }
              }
              return r
          }
          this.lastNeed = 1;
          this.lastTotal = 2;
          this.lastChar[0] = buf[buf.length - 1];
          return buf.toString("utf16le", i, buf.length - 1)
      }

      function utf16End(buf) {
          var r = buf && buf.length ? this.write(buf) : "";
          if (this.lastNeed) {
              var end = this.lastTotal - this.lastNeed;
              return r + this.lastChar.toString("utf16le", 0, end)
          }
          return r
      }

      function base64Text(buf, i) {
          var n = (buf.length - i) % 3;
          if (n === 0) return buf.toString("base64", i);
          this.lastNeed = 3 - n;
          this.lastTotal = 3;
          if (n === 1) {
              this.lastChar[0] = buf[buf.length - 1]
          } else {
              this.lastChar[0] = buf[buf.length - 2];
              this.lastChar[1] = buf[buf.length - 1]
          }
          return buf.toString("base64", i, buf.length - n)
      }

      function base64End(buf) {
          var r = buf && buf.length ? this.write(buf) : "";
          if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
          return r
      }

      function simpleWrite(buf) {
          return buf.toString(this.encoding)
      }

      function simpleEnd(buf) {
          return buf && buf.length ? this.write(buf) : ""
      }
  }, {
      "safe-buffer": 54
  }],
  54: [function (require, module, exports) {
      var buffer = require("buffer");
      var Buffer = buffer.Buffer;

      function copyProps(src, dst) {
          for (var key in src) {
              dst[key] = src[key]
          }
      }
      if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
          module.exports = buffer
      } else {
          copyProps(buffer, exports);
          exports.Buffer = SafeBuffer
      }

      function SafeBuffer(arg, encodingOrOffset, length) {
          return Buffer(arg, encodingOrOffset, length)
      }
      copyProps(Buffer, SafeBuffer);
      SafeBuffer.from = function (arg, encodingOrOffset, length) {
          if (typeof arg === "number") {
              throw new TypeError("Argument must not be a number")
          }
          return Buffer(arg, encodingOrOffset, length)
      };
      SafeBuffer.alloc = function (size, fill, encoding) {
          if (typeof size !== "number") {
              throw new TypeError("Argument must be a number")
          }
          var buf = Buffer(size);
          if (fill !== undefined) {
              if (typeof encoding === "string") {
                  buf.fill(fill, encoding)
              } else {
                  buf.fill(fill)
              }
          } else {
              buf.fill(0)
          }
          return buf
      };
      SafeBuffer.allocUnsafe = function (size) {
          if (typeof size !== "number") {
              throw new TypeError("Argument must be a number")
          }
          return Buffer(size)
      };
      SafeBuffer.allocUnsafeSlow = function (size) {
          if (typeof size !== "number") {
              throw new TypeError("Argument must be a number")
          }
          return buffer.SlowBuffer(size)
      }
  }, {
      buffer: 16
  }],
  55: [function (require, module, exports) {
      (function (global) {
          (function () {
              module.exports = deprecate;

              function deprecate(fn, msg) {
                  if (config("noDeprecation")) {
                      return fn
                  }
                  var warned = false;

                  function deprecated() {
                      if (!warned) {
                          if (config("throwDeprecation")) {
                              throw new Error(msg)
                          } else if (config("traceDeprecation")) {
                              console.trace(msg)
                          } else {
                              console.warn(msg)
                          }
                          warned = true
                      }
                      return fn.apply(this, arguments)
                  }
                  return deprecated
              }

              function config(name) {
                  try {
                      if (!global.localStorage) return false
                  } catch (_) {
                      return false
                  }
                  var val = global.localStorage[name];
                  if (null == val) return false;
                  return String(val).toLowerCase() === "true"
              }
          }).call(this)
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  }, {}],
  56: [function (require, module, exports) {
      arguments[4][9][0].apply(exports, arguments)
  }, {
      dup: 9
  }],
  57: [function (require, module, exports) {
      "use strict";
      var isArgumentsObject = require("is-arguments");
      var isGeneratorFunction = require("is-generator-function");
      var whichTypedArray = require("which-typed-array");
      var isTypedArray = require("is-typed-array");

      function uncurryThis(f) {
          return f.call.bind(f)
      }
      var BigIntSupported = typeof BigInt !== "undefined";
      var SymbolSupported = typeof Symbol !== "undefined";
      var ObjectToString = uncurryThis(Object.prototype.toString);
      var numberValue = uncurryThis(Number.prototype.valueOf);
      var stringValue = uncurryThis(String.prototype.valueOf);
      var booleanValue = uncurryThis(Boolean.prototype.valueOf);
      if (BigIntSupported) {
          var bigIntValue = uncurryThis(BigInt.prototype.valueOf)
      }
      if (SymbolSupported) {
          var symbolValue = uncurryThis(Symbol.prototype.valueOf)
      }

      function checkBoxedPrimitive(value, prototypeValueOf) {
          if (typeof value !== "object") {
              return false
          }
          try {
              prototypeValueOf(value);
              return true
          } catch (e) {
              return false
          }
      }
      exports.isArgumentsObject = isArgumentsObject;
      exports.isGeneratorFunction = isGeneratorFunction;
      exports.isTypedArray = isTypedArray;

      function isPromise(input) {
          return typeof Promise !== "undefined" && input instanceof Promise || input !== null && typeof input === "object" && typeof input.then === "function" && typeof input.catch === "function"
      }
      exports.isPromise = isPromise;

      function isArrayBufferView(value) {
          if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
              return ArrayBuffer.isView(value)
          }
          return isTypedArray(value) || isDataView(value)
      }
      exports.isArrayBufferView = isArrayBufferView;

      function isUint8Array(value) {
          return whichTypedArray(value) === "Uint8Array"
      }
      exports.isUint8Array = isUint8Array;

      function isUint8ClampedArray(value) {
          return whichTypedArray(value) === "Uint8ClampedArray"
      }
      exports.isUint8ClampedArray = isUint8ClampedArray;

      function isUint16Array(value) {
          return whichTypedArray(value) === "Uint16Array"
      }
      exports.isUint16Array = isUint16Array;

      function isUint32Array(value) {
          return whichTypedArray(value) === "Uint32Array"
      }
      exports.isUint32Array = isUint32Array;

      function isInt8Array(value) {
          return whichTypedArray(value) === "Int8Array"
      }
      exports.isInt8Array = isInt8Array;

      function isInt16Array(value) {
          return whichTypedArray(value) === "Int16Array"
      }
      exports.isInt16Array = isInt16Array;

      function isInt32Array(value) {
          return whichTypedArray(value) === "Int32Array"
      }
      exports.isInt32Array = isInt32Array;

      function isFloat32Array(value) {
          return whichTypedArray(value) === "Float32Array"
      }
      exports.isFloat32Array = isFloat32Array;

      function isFloat64Array(value) {
          return whichTypedArray(value) === "Float64Array"
      }
      exports.isFloat64Array = isFloat64Array;

      function isBigInt64Array(value) {
          return whichTypedArray(value) === "BigInt64Array"
      }
      exports.isBigInt64Array = isBigInt64Array;

      function isBigUint64Array(value) {
          return whichTypedArray(value) === "BigUint64Array"
      }
      exports.isBigUint64Array = isBigUint64Array;

      function isMapToString(value) {
          return ObjectToString(value) === "[object Map]"
      }
      isMapToString.working = typeof Map !== "undefined" && isMapToString(new Map);

      function isMap(value) {
          if (typeof Map === "undefined") {
              return false
          }
          return isMapToString.working ? isMapToString(value) : value instanceof Map
      }
      exports.isMap = isMap;

      function isSetToString(value) {
          return ObjectToString(value) === "[object Set]"
      }
      isSetToString.working = typeof Set !== "undefined" && isSetToString(new Set);

      function isSet(value) {
          if (typeof Set === "undefined") {
              return false
          }
          return isSetToString.working ? isSetToString(value) : value instanceof Set
      }
      exports.isSet = isSet;

      function isWeakMapToString(value) {
          return ObjectToString(value) === "[object WeakMap]"
      }
      isWeakMapToString.working = typeof WeakMap !== "undefined" && isWeakMapToString(new WeakMap);

      function isWeakMap(value) {
          if (typeof WeakMap === "undefined") {
              return false
          }
          return isWeakMapToString.working ? isWeakMapToString(value) : value instanceof WeakMap
      }
      exports.isWeakMap = isWeakMap;

      function isWeakSetToString(value) {
          return ObjectToString(value) === "[object WeakSet]"
      }
      isWeakSetToString.working = typeof WeakSet !== "undefined" && isWeakSetToString(new WeakSet);

      function isWeakSet(value) {
          return isWeakSetToString(value)
      }
      exports.isWeakSet = isWeakSet;

      function isArrayBufferToString(value) {
          return ObjectToString(value) === "[object ArrayBuffer]"
      }
      isArrayBufferToString.working = typeof ArrayBuffer !== "undefined" && isArrayBufferToString(new ArrayBuffer);

      function isArrayBuffer(value) {
          if (typeof ArrayBuffer === "undefined") {
              return false
          }
          return isArrayBufferToString.working ? isArrayBufferToString(value) : value instanceof ArrayBuffer
      }
      exports.isArrayBuffer = isArrayBuffer;

      function isDataViewToString(value) {
          return ObjectToString(value) === "[object DataView]"
      }
      isDataViewToString.working = typeof ArrayBuffer !== "undefined" && typeof DataView !== "undefined" && isDataViewToString(new DataView(new ArrayBuffer(1), 0, 1));

      function isDataView(value) {
          if (typeof DataView === "undefined") {
              return false
          }
          return isDataViewToString.working ? isDataViewToString(value) : value instanceof DataView
      }
      exports.isDataView = isDataView;
      var SharedArrayBufferCopy = typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : undefined;

      function isSharedArrayBufferToString(value) {
          return ObjectToString(value) === "[object SharedArrayBuffer]"
      }

      function isSharedArrayBuffer(value) {
          if (typeof SharedArrayBufferCopy === "undefined") {
              return false
          }
          if (typeof isSharedArrayBufferToString.working === "undefined") {
              isSharedArrayBufferToString.working = isSharedArrayBufferToString(new SharedArrayBufferCopy)
          }
          return isSharedArrayBufferToString.working ? isSharedArrayBufferToString(value) : value instanceof SharedArrayBufferCopy
      }
      exports.isSharedArrayBuffer = isSharedArrayBuffer;

      function isAsyncFunction(value) {
          return ObjectToString(value) === "[object AsyncFunction]"
      }
      exports.isAsyncFunction = isAsyncFunction;

      function isMapIterator(value) {
          return ObjectToString(value) === "[object Map Iterator]"
      }
      exports.isMapIterator = isMapIterator;

      function isSetIterator(value) {
          return ObjectToString(value) === "[object Set Iterator]"
      }
      exports.isSetIterator = isSetIterator;

      function isGeneratorObject(value) {
          return ObjectToString(value) === "[object Generator]"
      }
      exports.isGeneratorObject = isGeneratorObject;

      function isWebAssemblyCompiledModule(value) {
          return ObjectToString(value) === "[object WebAssembly.Module]"
      }
      exports.isWebAssemblyCompiledModule = isWebAssemblyCompiledModule;

      function isNumberObject(value) {
          return checkBoxedPrimitive(value, numberValue)
      }
      exports.isNumberObject = isNumberObject;

      function isStringObject(value) {
          return checkBoxedPrimitive(value, stringValue)
      }
      exports.isStringObject = isStringObject;

      function isBooleanObject(value) {
          return checkBoxedPrimitive(value, booleanValue)
      }
      exports.isBooleanObject = isBooleanObject;

      function isBigIntObject(value) {
          return BigIntSupported && checkBoxedPrimitive(value, bigIntValue)
      }
      exports.isBigIntObject = isBigIntObject;

      function isSymbolObject(value) {
          return SymbolSupported && checkBoxedPrimitive(value, symbolValue)
      }
      exports.isSymbolObject = isSymbolObject;

      function isBoxedPrimitive(value) {
          return isNumberObject(value) || isStringObject(value) || isBooleanObject(value) || isBigIntObject(value) || isSymbolObject(value)
      }
      exports.isBoxedPrimitive = isBoxedPrimitive;

      function isAnyArrayBuffer(value) {
          return typeof Uint8Array !== "undefined" && (isArrayBuffer(value) || isSharedArrayBuffer(value))
      }
      exports.isAnyArrayBuffer = isAnyArrayBuffer;
      ["isProxy", "isExternal", "isModuleNamespaceObject"].forEach(function (method) {
          Object.defineProperty(exports, method, {
              enumerable: false,
              value: function () {
                  throw new Error(method + " is not supported in userland")
              }
          })
      })
  }, {
      "is-arguments": 31,
      "is-generator-function": 33,
      "is-typed-array": 34,
      "which-typed-array": 59
  }],
  58: [function (require, module, exports) {
      (function (process) {
          (function () {
              var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors || function getOwnPropertyDescriptors(obj) {
                  var keys = Object.keys(obj);
                  var descriptors = {};
                  for (var i = 0; i < keys.length; i++) {
                      descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i])
                  }
                  return descriptors
              };
              var formatRegExp = /%[sdj%]/g;
              exports.format = function (f) {
                  if (!isString(f)) {
                      var objects = [];
                      for (var i = 0; i < arguments.length; i++) {
                          objects.push(inspect(arguments[i]))
                      }
                      return objects.join(" ")
                  }
                  var i = 1;
                  var args = arguments;
                  var len = args.length;
                  var str = String(f).replace(formatRegExp, function (x) {
                      if (x === "%%") return "%";
                      if (i >= len) return x;
                      switch (x) {
                          case "%s":
                              return String(args[i++]);
                          case "%d":
                              return Number(args[i++]);
                          case "%j":
                              try {
                                  return JSON.stringify(args[i++])
                              } catch (_) {
                                  return "[Circular]"
                              }
                              default:
                                  return x
                      }
                  });
                  for (var x = args[i]; i < len; x = args[++i]) {
                      if (isNull(x) || !isObject(x)) {
                          str += " " + x
                      } else {
                          str += " " + inspect(x)
                      }
                  }
                  return str
              };
              exports.deprecate = function (fn, msg) {
                  if (typeof process !== "undefined" && process.noDeprecation === true) {
                      return fn
                  }
                  if (typeof process === "undefined") {
                      return function () {
                          return exports.deprecate(fn, msg).apply(this, arguments)
                      }
                  }
                  var warned = false;

                  function deprecated() {
                      if (!warned) {
                          if (process.throwDeprecation) {
                              throw new Error(msg)
                          } else if (process.traceDeprecation) {
                              console.trace(msg)
                          } else {
                              console.error(msg)
                          }
                          warned = true
                      }
                      return fn.apply(this, arguments)
                  }
                  return deprecated
              };
              var debugs = {};
              var debugEnvRegex = /^$/;
              if (process.env.NODE_DEBUG) {
                  var debugEnv = process.env.NODE_DEBUG;
                  debugEnv = debugEnv.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*").replace(/,/g, "$|^").toUpperCase();
                  debugEnvRegex = new RegExp("^" + debugEnv + "$", "i")
              }
              exports.debuglog = function (set) {
                  set = set.toUpperCase();
                  if (!debugs[set]) {
                      if (debugEnvRegex.test(set)) {
                          var pid = process.pid;
                          debugs[set] = function () {
                              var msg = exports.format.apply(exports, arguments);
                              console.error("%s %d: %s", set, pid, msg)
                          }
                      } else {
                          debugs[set] = function () {}
                      }
                  }
                  return debugs[set]
              };

              function inspect(obj, opts) {
                  var ctx = {
                      seen: [],
                      stylize: stylizeNoColor
                  };
                  if (arguments.length >= 3) ctx.depth = arguments[2];
                  if (arguments.length >= 4) ctx.colors = arguments[3];
                  if (isBoolean(opts)) {
                      ctx.showHidden = opts
                  } else if (opts) {
                      exports._extend(ctx, opts)
                  }
                  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
                  if (isUndefined(ctx.depth)) ctx.depth = 2;
                  if (isUndefined(ctx.colors)) ctx.colors = false;
                  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
                  if (ctx.colors) ctx.stylize = stylizeWithColor;
                  return formatValue(ctx, obj, ctx.depth)
              }
              exports.inspect = inspect;
              inspect.colors = {
                  bold: [1, 22],
                  italic: [3, 23],
                  underline: [4, 24],
                  inverse: [7, 27],
                  white: [37, 39],
                  grey: [90, 39],
                  black: [30, 39],
                  blue: [34, 39],
                  cyan: [36, 39],
                  green: [32, 39],
                  magenta: [35, 39],
                  red: [31, 39],
                  yellow: [33, 39]
              };
              inspect.styles = {
                  special: "cyan",
                  number: "yellow",
                  boolean: "yellow",
                  undefined: "grey",
                  null: "bold",
                  string: "green",
                  date: "magenta",
                  regexp: "red"
              };

              function stylizeWithColor(str, styleType) {
                  var style = inspect.styles[styleType];
                  if (style) {
                      return "[" + inspect.colors[style][0] + "m" + str + "[" + inspect.colors[style][1] + "m"
                  } else {
                      return str
                  }
              }

              function stylizeNoColor(str, styleType) {
                  return str
              }

              function arrayToHash(array) {
                  var hash = {};
                  array.forEach(function (val, idx) {
                      hash[val] = true
                  });
                  return hash
              }

              function formatValue(ctx, value, recurseTimes) {
                  if (ctx.customInspect && value && isFunction(value.inspect) && value.inspect !== exports.inspect && !(value.constructor && value.constructor.prototype === value)) {
                      var ret = value.inspect(recurseTimes, ctx);
                      if (!isString(ret)) {
                          ret = formatValue(ctx, ret, recurseTimes)
                      }
                      return ret
                  }
                  var primitive = formatPrimitive(ctx, value);
                  if (primitive) {
                      return primitive
                  }
                  var keys = Object.keys(value);
                  var visibleKeys = arrayToHash(keys);
                  if (ctx.showHidden) {
                      keys = Object.getOwnPropertyNames(value)
                  }
                  if (isError(value) && (keys.indexOf("message") >= 0 || keys.indexOf("description") >= 0)) {
                      return formatError(value)
                  }
                  if (keys.length === 0) {
                      if (isFunction(value)) {
                          var name = value.name ? ": " + value.name : "";
                          return ctx.stylize("[Function" + name + "]", "special")
                      }
                      if (isRegExp(value)) {
                          return ctx.stylize(RegExp.prototype.toString.call(value), "regexp")
                      }
                      if (isDate(value)) {
                          return ctx.stylize(Date.prototype.toString.call(value), "date")
                      }
                      if (isError(value)) {
                          return formatError(value)
                      }
                  }
                  var base = "",
                      array = false,
                      braces = ["{", "}"];
                  if (isArray(value)) {
                      array = true;
                      braces = ["[", "]"]
                  }
                  if (isFunction(value)) {
                      var n = value.name ? ": " + value.name : "";
                      base = " [Function" + n + "]"
                  }
                  if (isRegExp(value)) {
                      base = " " + RegExp.prototype.toString.call(value)
                  }
                  if (isDate(value)) {
                      base = " " + Date.prototype.toUTCString.call(value)
                  }
                  if (isError(value)) {
                      base = " " + formatError(value)
                  }
                  if (keys.length === 0 && (!array || value.length == 0)) {
                      return braces[0] + base + braces[1]
                  }
                  if (recurseTimes < 0) {
                      if (isRegExp(value)) {
                          return ctx.stylize(RegExp.prototype.toString.call(value), "regexp")
                      } else {
                          return ctx.stylize("[Object]", "special")
                      }
                  }
                  ctx.seen.push(value);
                  var output;
                  if (array) {
                      output = formatArray(ctx, value, recurseTimes, visibleKeys, keys)
                  } else {
                      output = keys.map(function (key) {
                          return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array)
                      })
                  }
                  ctx.seen.pop();
                  return reduceToSingleString(output, base, braces)
              }

              function formatPrimitive(ctx, value) {
                  if (isUndefined(value)) return ctx.stylize("undefined", "undefined");
                  if (isString(value)) {
                      var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
                      return ctx.stylize(simple, "string")
                  }
                  if (isNumber(value)) return ctx.stylize("" + value, "number");
                  if (isBoolean(value)) return ctx.stylize("" + value, "boolean");
                  if (isNull(value)) return ctx.stylize("null", "null")
              }

              function formatError(value) {
                  return "[" + Error.prototype.toString.call(value) + "]"
              }

              function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
                  var output = [];
                  for (var i = 0, l = value.length; i < l; ++i) {
                      if (hasOwnProperty(value, String(i))) {
                          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true))
                      } else {
                          output.push("")
                      }
                  }
                  keys.forEach(function (key) {
                      if (!key.match(/^\d+$/)) {
                          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true))
                      }
                  });
                  return output
              }

              function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
                  var name, str, desc;
                  desc = Object.getOwnPropertyDescriptor(value, key) || {
                      value: value[key]
                  };
                  if (desc.get) {
                      if (desc.set) {
                          str = ctx.stylize("[Getter/Setter]", "special")
                      } else {
                          str = ctx.stylize("[Getter]", "special")
                      }
                  } else {
                      if (desc.set) {
                          str = ctx.stylize("[Setter]", "special")
                      }
                  }
                  if (!hasOwnProperty(visibleKeys, key)) {
                      name = "[" + key + "]"
                  }
                  if (!str) {
                      if (ctx.seen.indexOf(desc.value) < 0) {
                          if (isNull(recurseTimes)) {
                              str = formatValue(ctx, desc.value, null)
                          } else {
                              str = formatValue(ctx, desc.value, recurseTimes - 1)
                          }
                          if (str.indexOf("\n") > -1) {
                              if (array) {
                                  str = str.split("\n").map(function (line) {
                                      return "  " + line
                                  }).join("\n").substr(2)
                              } else {
                                  str = "\n" + str.split("\n").map(function (line) {
                                      return "   " + line
                                  }).join("\n")
                              }
                          }
                      } else {
                          str = ctx.stylize("[Circular]", "special")
                      }
                  }
                  if (isUndefined(name)) {
                      if (array && key.match(/^\d+$/)) {
                          return str
                      }
                      name = JSON.stringify("" + key);
                      if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                          name = name.substr(1, name.length - 2);
                          name = ctx.stylize(name, "name")
                      } else {
                          name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
                          name = ctx.stylize(name, "string")
                      }
                  }
                  return name + ": " + str
              }

              function reduceToSingleString(output, base, braces) {
                  var numLinesEst = 0;
                  var length = output.reduce(function (prev, cur) {
                      numLinesEst++;
                      if (cur.indexOf("\n") >= 0) numLinesEst++;
                      return prev + cur.replace(/\u001b\[\d\d?m/g, "").length + 1
                  }, 0);
                  if (length > 60) {
                      return braces[0] + (base === "" ? "" : base + "\n ") + " " + output.join(",\n  ") + " " + braces[1]
                  }
                  return braces[0] + base + " " + output.join(", ") + " " + braces[1]
              }
              exports.types = require("./support/types");

              function isArray(ar) {
                  return Array.isArray(ar)
              }
              exports.isArray = isArray;

              function isBoolean(arg) {
                  return typeof arg === "boolean"
              }
              exports.isBoolean = isBoolean;

              function isNull(arg) {
                  return arg === null
              }
              exports.isNull = isNull;

              function isNullOrUndefined(arg) {
                  return arg == null
              }
              exports.isNullOrUndefined = isNullOrUndefined;

              function isNumber(arg) {
                  return typeof arg === "number"
              }
              exports.isNumber = isNumber;

              function isString(arg) {
                  return typeof arg === "string"
              }
              exports.isString = isString;

              function isSymbol(arg) {
                  return typeof arg === "symbol"
              }
              exports.isSymbol = isSymbol;

              function isUndefined(arg) {
                  return arg === void 0
              }
              exports.isUndefined = isUndefined;

              function isRegExp(re) {
                  return isObject(re) && objectToString(re) === "[object RegExp]"
              }
              exports.isRegExp = isRegExp;
              exports.types.isRegExp = isRegExp;

              function isObject(arg) {
                  return typeof arg === "object" && arg !== null
              }
              exports.isObject = isObject;

              function isDate(d) {
                  return isObject(d) && objectToString(d) === "[object Date]"
              }
              exports.isDate = isDate;
              exports.types.isDate = isDate;

              function isError(e) {
                  return isObject(e) && (objectToString(e) === "[object Error]" || e instanceof Error)
              }
              exports.isError = isError;
              exports.types.isNativeError = isError;

              function isFunction(arg) {
                  return typeof arg === "function"
              }
              exports.isFunction = isFunction;

              function isPrimitive(arg) {
                  return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || typeof arg === "undefined"
              }
              exports.isPrimitive = isPrimitive;
              exports.isBuffer = require("./support/isBuffer");

              function objectToString(o) {
                  return Object.prototype.toString.call(o)
              }

              function pad(n) {
                  return n < 10 ? "0" + n.toString(10) : n.toString(10)
              }
              var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

              function timestamp() {
                  var d = new Date;
                  var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(":");
                  return [d.getDate(), months[d.getMonth()], time].join(" ")
              }
              exports.log = function () {
                  console.log("%s - %s", timestamp(), exports.format.apply(exports, arguments))
              };
              exports.inherits = require("inherits");
              exports._extend = function (origin, add) {
                  if (!add || !isObject(add)) return origin;
                  var keys = Object.keys(add);
                  var i = keys.length;
                  while (i--) {
                      origin[keys[i]] = add[keys[i]]
                  }
                  return origin
              };

              function hasOwnProperty(obj, prop) {
                  return Object.prototype.hasOwnProperty.call(obj, prop)
              }
              var kCustomPromisifiedSymbol = typeof Symbol !== "undefined" ? Symbol("util.promisify.custom") : undefined;
              exports.promisify = function promisify(original) {
                  if (typeof original !== "function") throw new TypeError('The "original" argument must be of type Function');
                  if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
                      var fn = original[kCustomPromisifiedSymbol];
                      if (typeof fn !== "function") {
                          throw new TypeError('The "util.promisify.custom" argument must be of type Function')
                      }
                      Object.defineProperty(fn, kCustomPromisifiedSymbol, {
                          value: fn,
                          enumerable: false,
                          writable: false,
                          configurable: true
                      });
                      return fn
                  }

                  function fn() {
                      var promiseResolve, promiseReject;
                      var promise = new Promise(function (resolve, reject) {
                          promiseResolve = resolve;
                          promiseReject = reject
                      });
                      var args = [];
                      for (var i = 0; i < arguments.length; i++) {
                          args.push(arguments[i])
                      }
                      args.push(function (err, value) {
                          if (err) {
                              promiseReject(err)
                          } else {
                              promiseResolve(value)
                          }
                      });
                      try {
                          original.apply(this, args)
                      } catch (err) {
                          promiseReject(err)
                      }
                      return promise
                  }
                  Object.setPrototypeOf(fn, Object.getPrototypeOf(original));
                  if (kCustomPromisifiedSymbol) Object.defineProperty(fn, kCustomPromisifiedSymbol, {
                      value: fn,
                      enumerable: false,
                      writable: false,
                      configurable: true
                  });
                  return Object.defineProperties(fn, getOwnPropertyDescriptors(original))
              };
              exports.promisify.custom = kCustomPromisifiedSymbol;

              function callbackifyOnRejected(reason, cb) {
                  if (!reason) {
                      var newReason = new Error("Promise was rejected with a falsy value");
                      newReason.reason = reason;
                      reason = newReason
                  }
                  return cb(reason)
              }

              function callbackify(original) {
                  if (typeof original !== "function") {
                      throw new TypeError('The "original" argument must be of type Function')
                  }

                  function callbackified() {
                      var args = [];
                      for (var i = 0; i < arguments.length; i++) {
                          args.push(arguments[i])
                      }
                      var maybeCb = args.pop();
                      if (typeof maybeCb !== "function") {
                          throw new TypeError("The last argument must be of type Function")
                      }
                      var self = this;
                      var cb = function () {
                          return maybeCb.apply(self, arguments)
                      };
                      original.apply(this, args).then(function (ret) {
                          process.nextTick(cb.bind(null, null, ret))
                      }, function (rej) {
                          process.nextTick(callbackifyOnRejected.bind(null, rej, cb))
                      })
                  }
                  Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
                  Object.defineProperties(callbackified, getOwnPropertyDescriptors(original));
                  return callbackified
              }
              exports.callbackify = callbackify
          }).call(this)
      }).call(this, require("_process"))
  }, {
      "./support/isBuffer": 56,
      "./support/types": 57,
      _process: 36,
      inherits: 30
  }],
  59: [function (require, module, exports) {
      (function (global) {
          (function () {
              "use strict";
              var forEach = require("for-each");
              var availableTypedArrays = require("available-typed-arrays");
              var callBound = require("call-bind/callBound");
              var $toString = callBound("Object.prototype.toString");
              var hasToStringTag = require("has-tostringtag/shams")();
              var g = typeof globalThis === "undefined" ? global : globalThis;
              var typedArrays = availableTypedArrays();
              var $slice = callBound("String.prototype.slice");
              var toStrTags = {};
              var gOPD = require("es-abstract/helpers/getOwnPropertyDescriptor");
              var getPrototypeOf = Object.getPrototypeOf;
              if (hasToStringTag && gOPD && getPrototypeOf) {
                  forEach(typedArrays, function (typedArray) {
                      if (typeof g[typedArray] === "function") {
                          var arr = new g[typedArray];
                          if (Symbol.toStringTag in arr) {
                              var proto = getPrototypeOf(arr);
                              var descriptor = gOPD(proto, Symbol.toStringTag);
                              if (!descriptor) {
                                  var superProto = getPrototypeOf(proto);
                                  descriptor = gOPD(superProto, Symbol.toStringTag)
                              }
                              toStrTags[typedArray] = descriptor.get
                          }
                      }
                  })
              }
              var tryTypedArrays = function tryAllTypedArrays(value) {
                  var foundName = false;
                  forEach(toStrTags, function (getter, typedArray) {
                      if (!foundName) {
                          try {
                              var name = getter.call(value);
                              if (name === typedArray) {
                                  foundName = name
                              }
                          } catch (e) {}
                      }
                  });
                  return foundName
              };
              var isTypedArray = require("is-typed-array");
              module.exports = function whichTypedArray(value) {
                  if (!isTypedArray(value)) {
                      return false
                  }
                  if (!hasToStringTag || !(Symbol.toStringTag in value)) {
                      return $slice($toString(value), 8, -1)
                  }
                  return tryTypedArrays(value)
              }
          }).call(this)
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  }, {
      "available-typed-arrays": 11,
      "call-bind/callBound": 17,
      "es-abstract/helpers/getOwnPropertyDescriptor": 19,
      "for-each": 21,
      "has-tostringtag/shams": 27,
      "is-typed-array": 34
  }]
}, {}, [1])(1)().decode;
class fe extends require("siyuan").Plugin {
  async onload() {
    let riffDir = `${window.siyuan.config.system.dataDir}/storage/riff/`;
    let confData = JSON.parse(await this.loadStorage("setting.json"));
    let confObj = { newCardLimitEx: 0 };
    siyuan.newCardLimitEx = Object.defineProperty(confObj, "newCardLimitEx", {
      set: (value) => {
        siyuan.newCardLimitEx = value;
        this.writeStorage("setting.json", JSON.stringify(confObj));
      },
      get: () => siyuan.newCardLimitEx,
    });
    confObj.newCardLimitEx =
      JSON.stringify(confData) == "{}" || !confData
        ? window.siyuan.config.flashcard.newCardLimit
        : (siyuan.newCardLimitEx = confData.newCardLimitEx);
    const checkData = (file) => {
      const filePath = path.join(riffDir, file);
      return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        let data = Buffer.alloc(0);
        stream.on("data", (chunk) => (data = Buffer.concat([data, chunk])));
        stream.on("end", () => resolve(data));
        stream.on("error", (err) => reject(err));
      }).then((fileData) => {
        return Object.values(mg5(fileData)).filter(
          d =>
            new Date().toLocaleDateString() ===
              new Date(d.C.LastReview).toLocaleDateString() &&
            d.C.ElapsedDays === 0
        ).length;
      });
    };

    const files = await fs.promises.readdir(riffDir);
    const cardsFiles = files.filter((file) => path.extname(file) === ".cards");
    let bol=true
    const setFlashcard = async () => {
      const newcardCount = await Promise.all(cardsFiles.map(checkData)).then(
        (results) => results.reduce((sum, count) => sum + count, 0)
      );

      const cardData = window.siyuan.config.flashcard;
      cardData.newCardLimit = confObj.newCardLimitEx - newcardCount;
      fetch(`${window.location.origin}/api/setting/setFlashcard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardData),
        keepalive: true,
      });
    };

    const observer = new MutationObserver((mutationsList) => {
      const targetElement = document.querySelector(
        '.b3-list-item.b3-list-item--big[data-name="card"]'
      );
      if (targetElement && !targetElement.onclick) {
        targetElement.addEventListener("click", function clickHandler() {
          targetElement.removeEventListener("click", clickHandler);
          const newCardLimit = document.getElementById("newCardLimit");
          if (newCardLimit) {
            newCardLimit.setAttribute("id", "newCardLimitEx");
            newCardLimit.value = confObj.newCardLimitEx;
            newCardLimit.addEventListener("change", (event) => {
              confObj.newCardLimitEx = event.target.value;
            });
          }
        });
      }

      const cardMenu = document.querySelector(
        "#commonMenu>.b3-menu__item:nth-child(7) .b3-menu__item"
      );
      if (cardMenu && bol){
        setFlashcard();
        bol=false
      } 
      bol=!cardMenu
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}

module.exports = fe;

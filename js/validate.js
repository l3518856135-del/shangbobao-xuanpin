/* ============================================================
   validate.js —— 字段校验引擎（D3）
   1. 统一社会信用代码（GB 32100-2015，第18位校验位本地实算）
   2. SC 食品生产许可证编号（结构校验，不校验最后一位）
   3. 生产日期 / 保质期（过期 / 临期判断）
   ============================================================ */

window.Validator = (function () {
  "use strict";

  /* ---------- 统一社会信用代码 ----------
     依据 GB 32100-2015 附录 A：
     - 字符集 31 位（去 I/O/S/V/Z）
     - 权重 W[i] = 3^(i) mod 31（i=0..16，从左到右第1..17位）
     - 校验位 = charset[(31 - (Σ Cᵢ×Wᵢ) mod 31) mod 31]
  */
  var USCC_CHARSET = "0123456789ABCDEFGHJKLMNPQRTUWXY";
  var USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];

  function validateUSCC(code) {
    var s = String(code == null ? "" : code).trim().toUpperCase();
    if (s.length !== 18) {
      return { ok: false, field: "uscc", reason: "统一社会信用代码应为 18 位，当前 " + s.length + " 位" };
    }
    var sum = 0;
    for (var i = 0; i < 17; i++) {
      var v = USCC_CHARSET.indexOf(s.charAt(i));
      if (v < 0) {
        return { ok: false, field: "uscc", reason: "第 " + (i + 1) + " 位「" + s.charAt(i) + "」为非法字符（不含 I/O/S/V/Z）" };
      }
      sum += v * USCC_WEIGHTS[i];
    }
    var R = sum % 31;
    var checkChar = USCC_CHARSET.charAt((31 - R) % 31);
    var provided = s.charAt(17);
    if (provided === checkChar) {
      return { ok: true, field: "uscc", checkChar: checkChar, reason: "校验位“" + checkChar + "”通过（GB 32100 实算）" };
    }
    return {
      ok: false, field: "uscc", checkChar: checkChar, provided: provided,
      reason: "校验位应为“" + checkChar + "”，当前为“" + provided + "”（GB 32100 本地实算，仅供结构自检）"
    };
  }

  /* ---------- SC 号结构校验 ----------
     格式：SC + 14 位数字（共 16 字符）。
     仅做结构校验；第14位校验码算法未公开，不校验其正确性。
  */
  function validateSC(code) {
    var s = String(code == null ? "" : code).trim().toUpperCase();
    var digits = s.replace(/^SC/i, "");
    if (!/^\d{14}$/.test(digits)) {
      return { ok: false, field: "sc", reason: "SC 号应为“SC + 14 位数字”，当前数字部分 " + digits.length + " 位" };
    }
    return { ok: true, field: "sc", digits: digits, reason: "SC 号结构正确（14 位数字；第14位校验位不校验）" };
  }

  /* ---------- 生产日期 / 保质期 ---------- */
  function parseShelfLife(s) {
    if (!s) { return null; }
    var m = String(s).trim().match(/(\d+(?:\.\d+)?)\s*(天|个月|月|年)/i);
    if (!m) { return null; }
    var n = parseFloat(m[1]);
    var unit = m[2];
    if (unit === "天") { return n; }
    if (unit === "个月" || unit === "月") { return Math.round(n * 30); }
    if (unit === "年") { return Math.round(n * 365); }
    return null;
  }

  function validateProduceDate(dateStr, shelfLife) {
    if (!dateStr) {
      return { ok: false, field: "date", status: "missing", reason: "未填写生产日期" };
    }
    var pd = new Date(dateStr + "T00:00:00");
    if (isNaN(pd.getTime())) {
      return { ok: false, field: "date", status: "invalid", reason: "生产日期格式非法" };
    }
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (pd > today) {
      return { ok: false, field: "date", status: "future", reason: "生产日期晚于当前日期，可能填写有误" };
    }
    var days = parseShelfLife(shelfLife);
    if (days === null || days === undefined) {
      return { ok: true, field: "date", status: "dateOnly", reason: "生产日期有效（未提供可解析的保质期，不做临期判断）" };
    }
    var expiry = new Date(pd.getTime() + days * 86400000);
    if (today > expiry) {
      return { ok: false, field: "date", status: "expired", reason: "已过保质期（生产 " + dateStr + " + 保质期 " + shelfLife + "）" };
    }
    var remaining = Math.round((expiry - today) / 86400000);
    if (remaining < days / 3) {
      return { ok: false, field: "date", status: "nearExpiry", reason: "临期：剩约 " + remaining + " 天（不足保质期 1/3），建议黄灯标注" };
    }
    return { ok: true, field: "date", status: "ok", reason: "生产日期与保质期正常（剩约 " + remaining + " 天）" };
  }

  return {
    validateUSCC: validateUSCC,
    validateSC: validateSC,
    validateProduceDate: validateProduceDate
  };
})();
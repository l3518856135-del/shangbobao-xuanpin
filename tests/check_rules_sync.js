/* ============================================================
   check_rules_sync.js —— 规则库双份一致性校验（B9）
   背景：data/rules.json 是权威源，js/rules-data.js 是 file:// 运行时镜像。
        两者手工维护，容易漏同步。
   运行：node tests/check_rules_sync.js
   退出码：0 一致；1 有差异
   ============================================================ */

"use strict";

const path = require("path");
const fs = require("fs");

global.window = {};
require(path.join(__dirname, "..", "js", "rules-data.js"));

const jsonPath = path.join(__dirname, "..", "data", "rules.json");
const jsonBase = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const jsBase = global.window.RULE_BASE;

function sortKeys(obj) {
  if (Array.isArray(obj)) { return obj.map(sortKeys); }
  if (obj && typeof obj === "object") {
    const out = {};
    Object.keys(obj).sort().forEach((k) => { out[k] = sortKeys(obj[k]); });
    return out;
  }
  return obj;
}

const a = JSON.stringify(sortKeys(jsonBase));
const b = JSON.stringify(sortKeys(jsBase));

if (a === b) {
  console.log("规则库一致：data/rules.json 与 js/rules-data.js 内容相同（" +
    (jsonBase.rules || []).length + " 条规则）");
  process.exit(0);
}

console.log("规则库不一致，差异如下：");

const diffRules = [];
const jsonRules = jsonBase.rules || [];
const jsRules = jsBase.rules || [];
if (jsonRules.length !== jsRules.length) {
  console.log("  规则条数不同：JSON " + jsonRules.length + " / JS " + jsRules.length);
}
const byId = {};
jsRules.forEach((r) => { byId[r.id] = r; });
jsonRules.forEach((r) => {
  const other = byId[r.id];
  if (!other) { diffRules.push(r.id + "：JS 中缺失"); return; }
  Object.keys(r).forEach((k) => {
    if (JSON.stringify(r[k]) !== JSON.stringify(other[k])) {
      diffRules.push(r.id + "：" + k + " 不一致");
    }
  });
});

/* 词表 / meta 差异 */
["meta", "wordLists", "scCategoryCodes", "judgeLevels"].forEach((sec) => {
  if (JSON.stringify(jsonBase[sec]) !== JSON.stringify(jsBase[sec])) {
    diffRules.push("顶层字段 " + sec + " 不一致");
  }
});

if (!diffRules.length) {
  diffRules.push("结构整体不一致（非规则字段级差异）");
}
diffRules.forEach((d) => console.log("  - " + d));
console.log("请改 data/rules.json 后同步 js/rules-data.js");
process.exit(1);

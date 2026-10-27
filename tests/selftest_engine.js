/* ============================================================
   selftest_engine.js —— 规则引擎 48 条自测用例
   运行：node tests/selftest_engine.js
   产出：控制台结果 + docs/自测报告_规则引擎.md
   ============================================================ */

"use strict";

const path = require("path");
const fs = require("fs");

global.window = {};
require(path.join(__dirname, "..", "js", "rules-data.js"));
require(path.join(__dirname, "..", "js", "validate.js"));
require(path.join(__dirname, "..", "js", "engine.js"));

const Engine = global.window.Engine;
const V = global.window.Validator;

/* ---------- 日期工具 ---------- */
function d(offsetDays) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + offsetDays);
  const p = (n) => (n < 10 ? "0" : "") + n;
  return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate());
}

/* ---------- 基准数据 ---------- */
const YB_BASE = {
  type: "YB", subject: "company", platform: "douyin",
  productName: "测试梨膏", category: "蜜饯果膏类",
  producer: "测试食品有限公司", origin: "山东省烟台市",
  spec: "260g/瓶", produceDate: d(-30), shelfLife: "12个月",
  scNumber: "SC11737068200011", uscc: "91370682MA3D8C2K5N", batchNo: "",
  labelComplete: "完整", nutritionLabel: "已提供", claimText: ""
};
const BJ_BASE = {
  type: "BJ", subject: "company", platform: "douyin",
  productName: "测试胶囊", category: "保健食品", spec: "0.5g×60粒",
  produceDate: d(-30), shelfLife: "24个月",
  blueHat: "有", regNumber: "国食健字G20260001", warningText: "有", claimText: ""
};
const NC_BASE = {
  type: "NC", subject: "farmer", platform: "douyin",
  productName: "测试苹果", category: "食用农产品-鲜果",
  spec: "5斤/箱", produceDate: d(-10), shelfLife: "30天",
  qualifiedCert: "已提供", quarantineCert: "不适用（非畜禽）", claimText: ""
};
const DL_BASE = {
  type: "DL", subject: "coop", platform: "douyin",
  productName: "测试地标苹果", category: "地理标志农产品",
  spec: "10斤/箱", produceDate: d(-10), shelfLife: "30天",
  giAuth: "已提供", originMatch: "一致", claimText: ""
};

const withData = (base, patch) => Object.assign({}, base, patch);

/* ---------- 40 条用例 ---------- */
const CASES = [
  /* === 通用宣称 COM（13 条） === */
  { no: 1, group: "COM", desc: "疾病治疗宣称命中 → 红",
    data: withData(YB_BASE, { claimText: "这款梨膏能治疗咳嗽" }),
    expect: { level: "RED", ids: ["R-COM-001"] } },

  { no: 2, group: "COM", desc: "医疗用语「止咳」命中 → 红（2026-10-25 扩充）",
    data: withData(YB_BASE, { claimText: "润喉止咳效果好" }),
    expect: { level: "RED", ids: ["R-COM-001"] } },

  { no: 3, group: "COM", desc: "非保健食品宣称保健功能 → 红",
    data: withData(YB_BASE, { claimText: "增强免疫力，改善睡眠" }),
    expect: { level: "RED", ids: ["R-COM-002"] } },

  { no: 4, group: "COM", desc: "保健食品同样文案不套用 R-COM-002（防误杀）",
    data: withData(BJ_BASE, { claimText: "增强免疫力" }),
    expect: { level: "GREEN", ids: [], notIds: ["R-COM-002"] } },

  { no: 5, group: "COM", desc: "绝对化用语命中（最好/全网最低价）→ 黄",
    data: withData(YB_BASE, { claimText: "这是最好的，全网最低价" }),
    expect: { level: "YELLOW", ids: ["R-COM-003"] } },

  { no: 6, group: "COM", desc: "「最/第一」常见非绝对化表述不误报 → 绿",
    multi: [
      withData(YB_BASE, { claimText: "产地直发，当季采摘，脆甜多汁" }),
      withData(YB_BASE, { claimText: "最后一天，抓紧下单" }),
      withData(YB_BASE, { claimText: "第一场直播，最近发货" })
    ],
    expect: { level: "GREEN", ids: [], notIds: ["R-COM-003"] } },

  { no: 7, group: "COM", desc: "虚构权威背书（央视推荐/政府指定）→ 黄（2026-10-25 接线）",
    data: withData(YB_BASE, { claimText: "央视推荐，政府指定产品" }),
    expect: { level: "YELLOW", ids: ["R-COM-004"] } },

  { no: 8, group: "COM", desc: "承诺性效果表述（一周见效/无效退款）→ 黄（2026-10-25 接线）",
    data: withData(YB_BASE, { claimText: "一周见效，无效退款" }),
    expect: { level: "YELLOW", ids: ["R-COM-005"] } },

  { no: 9, group: "COM", desc: "正常售后文案不误报（七天无理由/最新鲜）→ 绿",
    data: withData(YB_BASE, { claimText: "最新鲜的当季果子，支持七天无理由退货" }),
    expect: { level: "GREEN", ids: [], notIds: ["R-COM-003", "R-COM-004", "R-COM-005"] } },

  { no: 10, group: "COM", desc: "报告产品名与申报品不符 → 红",
    data: withData(YB_BASE, { reportNo: "SDJC-2026-0912", reportProductName: "苹果汁饮料",
      reportSpec: "500ml/瓶", reportBatch: "20260801" }),
    expect: { level: "RED", ids: ["R-COM-006"] } },

  { no: 11, group: "COM", desc: "报告名带括号补充说明，不算不符（防误杀）",
    data: withData(YB_BASE, { productName: "莱阳梨膏（案例示例）", reportProductName: "莱阳梨膏",
      reportSpec: "260g/瓶" }),
    expect: { level: "GREEN", ids: [] } },

  { no: 12, group: "COM", desc: "「苹果汁 ⊃ 苹果」不得靠包含关系绕过 → 红（2026-10-25 修正）",
    data: withData(YB_BASE, { productName: "苹果", reportNo: "SDJC-2026-0912",
      reportProductName: "苹果汁", reportSpec: "260g/瓶" }),
    expect: { level: "RED", ids: ["R-COM-006"] } },

  { no: 13, group: "COM", desc: "报告规格不符 → 红",
    data: withData(YB_BASE, { reportNo: "SDJC-2026-0912", reportProductName: "测试梨膏",
      reportSpec: "500ml/瓶" }),
    expect: { level: "RED", ids: ["R-COM-006"] } },

  { no: 14, group: "COM", desc: "口播稿单独命中医疗用语 → 红（评审 C5 分开采集）",
    data: withData(YB_BASE, { claimText: "产地直供", oralClaim: "吃了能降三高" }),
    expect: { level: "RED", ids: ["R-COM-001"] } },

  { no: 15, group: "COM", desc: "报告检验结论不合格 → 红（评审 C2）",
    data: withData(YB_BASE, { reportNo: "SDJC-2026-0912", reportProductName: "测试梨膏",
      reportSpec: "260g/瓶", reportConclusion: "不合格" }),
    expect: { level: "RED", ids: ["R-COM-006"] } },

  { no: 16, group: "COM", desc: "检测报告已过有效期 → 黄（评审 C2）",
    data: withData(YB_BASE, { reportNo: "SDJC-2026-0912", reportProductName: "测试梨膏",
      reportSpec: "260g/瓶", reportValidUntil: d(-10) }),
    expect: { level: "YELLOW", ids: ["R-COM-006"] } },

  { no: 17, group: "COM", desc: "报告缺 CMA/CNAS 资质标识 → 黄（评审 C2）",
    data: withData(YB_BASE, { reportNo: "SDJC-2026-0912", reportProductName: "测试梨膏",
      reportSpec: "260g/瓶", reportCert: "都没有 / 不确定" }),
    expect: { level: "YELLOW", ids: ["R-COM-006"] } },

  { no: 41, group: "COM", desc: "绝对化新词（最便宜/全国第一/行业第一）→ 黄（评审 R7）",
    data: withData(YB_BASE, { claimText: "这是最便宜的，全国第一" }),
    expect: { level: "YELLOW", ids: ["R-COM-003"] } },

  { no: 42, group: "COM", desc: "医疗用语新词（止痛/清肺/排毒/防感冒）→ 红（评审 R7）",
    data: withData(YB_BASE, { claimText: "可以止痛、清肺排毒、防感冒" }),
    expect: { level: "RED", ids: ["R-COM-001"] } },

  { no: 43, group: "COM", desc: "安全性绝对承诺「无副作用」→ 黄（评审 R7）",
    data: withData(YB_BASE, { claimText: "纯天然配方，本品无副作用" }),
    expect: { level: "YELLOW", ids: ["R-COM-005"] } },

  { no: 44, group: "COM", desc: "报告批号与包装批号不符 → 黄（评审 R8）",
    data: withData(YB_BASE, { batchNo: "20260915", reportNo: "SDJC-2026-0912",
      reportProductName: "测试梨膏", reportSpec: "260g/瓶", reportBatch: "2026-08-01" }),
    expect: { level: "YELLOW", ids: ["R-COM-006"] } },

  /* === 预包装食品 YB（8 条） === */
  { no: 14, group: "YB", desc: "经销主体 SC 号为空 → 黄（仅销售依法不需许可，需备案）",
    data: withData(YB_BASE, { scNumber: "", subject: "company" }),
    expect: { level: "YELLOW", ids: ["R-YB-001"] } },

  { no: 15, group: "YB", desc: "SC 号 13 位结构异常 → 黄（R-YB-002）",
    data: withData(YB_BASE, { scNumber: "SC1063701112345" }),
    expect: { level: "YELLOW", ids: ["R-YB-002"] } },

  { no: 16, group: "YB", desc: "农户自销主体 SC 号为空 → 红（生产须持许可）",
    data: withData(YB_BASE, { scNumber: "", subject: "farmer" }),
    expect: { level: "RED", ids: ["R-YB-001"] } },

  { no: 17, group: "YB", desc: "标签存在法定缺项 → 黄（R-YB-004）",
    data: withData(YB_BASE, { labelComplete: "缺项" }),
    expect: { level: "YELLOW", ids: ["R-YB-004"] } },

  { no: 18, group: "YB", desc: "营养成分表缺失 → 黄（R-YB-005）",
    data: withData(YB_BASE, { nutritionLabel: "缺失" }),
    expect: { level: "YELLOW", ids: ["R-YB-005"] } },

  { no: 19, group: "YB", desc: "已过保质期 → 红（R-YB-006 由黄升红）",
    data: withData(YB_BASE, { produceDate: d(-400), shelfLife: "30天" }),
    expect: { level: "RED", ids: ["R-YB-006"] } },

  { no: 20, group: "YB", desc: "临期（剩余不足 1/3 保质期）→ 黄",
    data: withData(YB_BASE, { produceDate: d(-75), shelfLife: "90天" }),
    expect: { level: "YELLOW", ids: ["R-YB-006"] } },

  { no: 21, group: "YB", desc: "生产日期晚于今天 → 黄（日期异常）",
    data: withData(YB_BASE, { produceDate: d(10), shelfLife: "12个月" }),
    expect: { level: "YELLOW", ids: ["R-YB-006"] } },

  /* === 保健食品 BJ（6 条） === */
  { no: 22, group: "BJ", desc: "无蓝帽子标识 → 红（R-BJ-001）",
    data: withData(BJ_BASE, { blueHat: "无" }),
    expect: { level: "RED", ids: ["R-BJ-001"] } },

  { no: 23, group: "BJ", desc: "无注册号/备案号 → 红（R-BJ-002）",
    data: withData(BJ_BASE, { regNumber: "" }),
    expect: { level: "RED", ids: ["R-BJ-002"] } },

  { no: 24, group: "BJ", desc: "缺少法定警示语 → 黄（R-BJ-004）",
    data: withData(BJ_BASE, { warningText: "无" }),
    expect: { level: "YELLOW", ids: ["R-BJ-004"] } },

  { no: 25, group: "BJ", desc: "蓝帽/注册号/警示语齐全 → 绿",
    data: withData(BJ_BASE, {}),
    expect: { level: "GREEN", ids: [] } },

  { no: 26, group: "BJ", desc: "红压黄：无蓝帽(红)+无警示语(黄) → 判红",
    data: withData(BJ_BASE, { blueHat: "无", warningText: "无" }),
    expect: { level: "RED", ids: ["R-BJ-001", "R-BJ-004"] } },

  { no: 27, group: "BJ", desc: "保健食品过期 → 红（2026-10-25 日期校验扩展到全产品线）",
    data: withData(BJ_BASE, { produceDate: d(-800), shelfLife: "12个月" }),
    expect: { level: "RED", ids: ["R-YB-006"] } },

  /* === 食用农产品 NC（6 条） === */
  { no: 28, group: "NC", desc: "未提供承诺达标合格证 → 黄（R-NC-001）",
    data: withData(NC_BASE, { qualifiedCert: "未提供" }),
    expect: { level: "YELLOW", ids: ["R-NC-001"] } },

  { no: 29, group: "NC", desc: "畜禽未提供检疫合格证明 → 红（评审 R6 单独规则）",
    data: withData(NC_BASE, { quarantineCert: "未提供" }),
    expect: { level: "RED", ids: ["R-NC-003"] } },

  { no: 30, group: "NC", desc: "非畜禽（不适用）不因检疫字段误判 → 绿",
    data: withData(NC_BASE, { quarantineCert: "不适用（非畜禽）" }),
    expect: { level: "GREEN", ids: [], notIds: ["R-NC-001", "R-NC-003"] } },

  { no: 31, group: "NC", desc: "合格证齐全 → 绿（且不要求 SC）",
    data: withData(NC_BASE, {}),
    expect: { level: "GREEN", ids: [], notIds: ["R-YB-001", "R-YB-002"] } },

  { no: 32, group: "NC", desc: "食用农产品无 SC 不误判为缺证（核心防误杀）",
    data: withData(NC_BASE, { scNumber: "" }),
    expect: { level: "GREEN", ids: [], notIds: ["R-YB-001"] } },

  { no: 33, group: "NC", desc: "食用农产品过期 → 红（2026-10-25 扩展）",
    data: withData(NC_BASE, { produceDate: d(-60), shelfLife: "30天" }),
    expect: { level: "RED", ids: ["R-YB-006"] } },

  /* === 地理标志 DL（4 条） === */
  { no: 34, group: "DL", desc: "未提供地标授权证明 → 红（R-DL-001）",
    data: withData(DL_BASE, { giAuth: "未提供" }),
    expect: { level: "RED", ids: ["R-DL-001"] } },

  { no: 35, group: "DL", desc: "产区宣称与产地不一致 → 黄（R-DL-002）",
    data: withData(DL_BASE, { originMatch: "不一致" }),
    expect: { level: "YELLOW", ids: ["R-DL-002"] } },

  { no: 36, group: "DL", desc: "授权与产地均一致 → 绿",
    data: withData(DL_BASE, {}),
    expect: { level: "GREEN", ids: [] } },

  { no: 37, group: "DL", desc: "地理标志产品临期 → 黄（2026-10-25 扩展）",
    data: withData(DL_BASE, { produceDate: d(-25), shelfLife: "30天" }),
    expect: { level: "YELLOW", ids: ["R-YB-006"] } },

  /* === 字段校验器（3 条） === */
  { no: 38, group: "VALIDATOR", desc: "统一社会信用代码校验位合法（莱阳演示号）→ 通过",
    validator: () => V.validateUSCC("91370682MA3D8C2K5N").ok === true,
    expect: { ok: true } },

  { no: 39, group: "VALIDATOR", desc: "统一社会信用代码校验位错误 → 拒绝",
    validator: () => {
      const r = V.validateUSCC("91370100MA3D8C2K55");
      return r.ok === false && /校验位应为/.test(r.reason);
    },
    expect: { ok: true } },

  { no: 40, group: "VALIDATOR", desc: "SC 号非 14 位数字 → 结构校验拒绝",
    validator: () => {
      const r = V.validateSC("SC1063701112345");
      return r.ok === false && /14 位/.test(r.reason);
    },
    expect: { ok: true } }
];

/* ---------- 执行 ---------- */
function idsOf(result) {
  return result.items.map((it) => it.rule.id);
}

const rows = [];
let pass = 0;

CASES.forEach((c) => {
  let actual, ok, note = "";

  if (c.validator) {
    const res = c.validator();
    ok = res === c.expect.ok;
    actual = ok ? "通过" : "未通过";
    if (!ok) { note = "校验器断言失败"; }
  } else {
    const variants = c.multi || [c.data];
    const results = variants.map((vd) => {
      const res = Engine.judge(vd);
      const ids = idsOf(res);
      const levelOk = res.level === c.expect.level;
      const idsOk = c.expect.ids.every((id) => ids.indexOf(id) !== -1);
      const notOk = (c.expect.notIds || []).every((id) => ids.indexOf(id) === -1);
      return { level: res.level, ids: ids, ok: levelOk && idsOk && notOk, levelOk: levelOk, idsOk: idsOk, notOk: notOk, claim: vd.claimText };
    });
    ok = results.every((r) => r.ok);
    if (variants.length === 1) {
      actual = results[0].level + (results[0].ids.length ? " / " + results[0].ids.join("、") : " / 无命中");
    } else {
      actual = results.filter((r) => r.ok).length + "/" + results.length + " 变体通过";
    }
    if (!ok) {
      const fail = results.filter((r) => !r.ok);
      note = fail.map((r) => {
        const parts = [];
        if (!r.levelOk) { parts.push("等级 " + c.expect.level + "→" + r.level); }
        if (!r.idsOk) { parts.push("缺命中 " + c.expect.ids.filter((id) => r.ids.indexOf(id) === -1).join("、")); }
        if (!r.notOk) { parts.push("误命中 " + (c.expect.notIds || []).filter((id) => r.ids.indexOf(id) !== -1).join("、")); }
        return "「" + (r.claim || "变体") + "」" + parts.join("；");
      }).join(" / ");
    }
  }

  if (ok) { pass++; }
  rows.push({ no: c.no, group: c.group, desc: c.desc, expectText: c.validator ? (c.expect.ok ? "通过" : "拒绝") : (c.expect.level + (c.expect.ids.length ? " / " + c.expect.ids.join("、") : " / 无命中")), actual, ok, note });
});

/* ---------- 输出 ---------- */
const total = CASES.length;
const rate = ((pass / total) * 100).toFixed(1);

console.log("规则引擎自测：通过 " + pass + " / " + total + "（" + rate + "%）");
rows.filter((r) => !r.ok).forEach((r) => {
  console.log("  [FAIL] " + r.group + " #" + r.no + " " + r.desc + " → " + r.note);
});

const groups = ["COM", "YB", "BJ", "NC", "DL", "VALIDATOR"];
const groupName = { COM: "通用宣称", YB: "预包装食品", BJ: "保健食品", NC: "食用农产品", DL: "地理标志", VALIDATOR: "字段校验器" };
function groupDesc(g) {
  return {
    COM: "疾病/医疗用语、保健功能、绝对化、承诺效果、虚构背书、报告比对",
    YB: "SC 证（按主体分流）、标签、营养标签、日期",
    BJ: "蓝帽子、注册号、警示语、日期",
    NC: "合格证、畜禽检疫（缺失判红）、无需 SC 防误杀、日期",
    DL: "专用标志授权、产地一致性、日期",
    VALIDATOR: "GB 32100 校验位、SC 结构"
  }[g];
}

let md = "";
md += "# 规则引擎自测报告（" + total + " 条）\n\n";
md += "> 执行日期：" + d(0) + "　执行方式：`node tests/selftest_engine.js`（离线、可复跑）\n";
md += "> 规则库版本：v0.2（修订稿）　判定引擎：`js/engine.js` + `js/validate.js`\n\n";
md += "## 一、总体结果\n\n";
md += "| 指标 | 数值 |\n|---|---|\n";
md += "| 用例总数 | " + total + " |\n";
md += "| 通过 | " + pass + " |\n";
md += "| 失败 | " + (total - pass) + " |\n";
md += "| 通过率 | **" + rate + "%** |\n\n";
md += pass === total
  ? "**结论：" + total + " 条用例全部通过，未发现误报/漏报。**\n\n"
  : "**结论：存在未通过用例，需修复后复测（详见第四节）。**\n\n";

md += "## 二、分组覆盖\n\n";
md += "| 分组 | 用例数 | 通过 | 说明 |\n|---|---|---|---|\n";
groups.forEach((g) => {
  const list = rows.filter((r) => r.group === g);
  md += "| " + groupName[g] + "（" + g + "） | " + list.length + " | " + list.filter((r) => r.ok).length + " | " + groupDesc(g) + " |\n";
});
md += "## 三、用例明细\n\n";
groups.forEach((g) => {
  md += "### " + groupName[g] + "（" + g + "）\n\n";
  md += "| # | 用例目的 | 期望 | 实际 | 结果 |\n|---|---|---|---|---|\n";
  rows.filter((r) => r.group === g).forEach((r, idx) => {
    md += "| " + (idx + 1) + " | " + r.desc + " | " + r.expectText + " | " + r.actual + " | " + (r.ok ? "通过" : "**失败**：" + r.note) + " |\n";
  });
  md += "\n";
});

md += "## 四、误报/漏报修正记录\n\n";
const fails = rows.filter((r) => !r.ok);
if (!fails.length) {
  md += "本轮 " + total + " 条用例首次执行全部通过。\n\n";
} else {
  fails.forEach((r) => { md += "- #" + r.no + " " + r.desc + "：" + r.note + "\n"; });
}
md += "\n历史修正（开发与评审阶段已处理）：\n\n";
md += "| 阶段 | 问题 | 处理 |\n|---|---|---|\n";
md += "| D4/D5 | 空字段被当作违规 | 空值一律不判违规，缺信息走灰级清单 |\n";
md += "| D5 | GREEN 且关键字段缺失仍判可播 | 改为灰·信息不足 |\n";
md += "| D11 | 换商品未重审却导出旧档案 | 档案导出增加一致性校验 |\n";
md += "| D12 | 档案表格混入内部技术键 | 过滤 type/subject/platform |\n";
md += "| D14 | 报告名括号差异可能误判 | 归一化去括号后再比对 |\n";
md += "| 评审 P0-A3 | 裸词“最/第一”误杀正常表述 | 词表收窄为组合词 |\n";
md += "| 评审 P0-A4 | “止咳”等医疗用语漏判 | 疾病词表扩充 9 个医疗用语 |\n";
md += "| 评审 P0-A10 | “苹果汁”包含“苹果”绕过报告比对 | 改为归一化后严格相等 |\n";
md += "| 评审 P0-A1/A2 | 畜禽检疫不判、非预包装不查过期 | 检疫字段接线；日期校验覆盖全产品线 |\n";
md += "| 评审 P0-A5/A6 | 承诺效果、虚构背书规则未接线 | 新增两张词表并接入引擎 |\n";
md += "| 第三轮复测 R6 | 畜禽缺检疫证明仅判黄 | 新增 R-NC-003，未按规定检疫的肉类判红 |\n";
md += "| 第三轮复测 R7 | 词表收窄后漏放（最便宜/止痛/无副作用等） | 补三类词表并各加自测用例 |\n";
md += "| 第三轮复测 R8 | 报告批号采集但不参与比对 | 新增包装批号字段，批号不符判黄 |\n";
md += "\n## 五、复跑方式\n\n";
md += "```bash\nnode tests/selftest_engine.js\n```\n\n";
md += "脚本加载真实的 `rules-data.js / validate.js / engine.js`，不 mock 判定逻辑，结果可复现。\n";
md += "灰·信息不足与四态聚合由 UI 层 `computeMissing()` 参与，本表验证的是规则引擎层判定；灰级链路见案例三。\n";

const outPath = path.join(__dirname, "..", "docs", "自测报告_规则引擎.md");
fs.writeFileSync(outPath, md, "utf8");
console.log("报告已写入：" + outPath);

process.exit(pass === total ? 0 : 1);

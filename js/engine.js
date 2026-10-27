/* ============================================================
   engine.js —— 规则判定引擎（D4）
   输入：collectForm() 的表单数据（含 type/subject/platform 与各字段）
   输出：{ level, items: [{ rule, hints, level }] }
   ============================================================
   说明：
   1. 只做"可 100% 复核"的硬判定（RULE 词表命中 + 字段一致性）。
   2. AI-SEMANTIC 语义判断只提示、不判定（本版未启用语义，不产出）。
   3. 类别码对照表 / 保健食品 27 功能范围仍为占位，对应规则暂不启用，
      避免误判（属地化人工核对留在 D5+ 与人工终审）。
   4. 红线：AI 不生成法条；所有【待核对】条款号须人工确认后方可启用。
   ============================================================ */

window.Engine = (function () {
  "use strict";

  var LEVEL_ORDER = { RED: 4, YELLOW: 3, GRAY: 2, GREEN: 1 };

  function hitAny(text, words) {
    if (!text || !words || !words.length) { return []; }
    var t = String(text);
    var hits = [];
    words.forEach(function (w) {
      if (w && t.indexOf(w) !== -1) { hits.push(w); }
    });
    return hits;
  }

  function findRule(id) {
    var rules = (window.RULE_BASE && window.RULE_BASE.rules) || [];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].id === id) { return rules[i]; }
    }
    return null;
  }

  function addItem(items, ruleId, hints, levelOverride) {
    var rule = findRule(ruleId);
    if (!rule) { return; }
    items.push({ rule: rule, hints: hints || [], level: levelOverride || rule.level });
  }

  /* ---------- 文本归一化（用于报告与申报产品比对） ----------
     去掉空白、去掉括号补充说明（如"（案例示例）"）、统一小写，
     避免"莱阳梨膏（示例）" vs "莱阳梨膏" 这类差异造成误判。 */
  function normalizeText(s) {
    return String(s == null ? "" : s)
      .replace(/[\s\u00a0]/g, "")
      .replace(/[（(][^）)]*[)）]/g, "")
      .toLowerCase();
  }

  // 归一化后完全相等才算同一产品（2026-10-25 起不再用“互相包含”）
  function sameThing(a, b) {
    if (!a || !b) { return true; }        // 任一为空不比对，避免误杀
    /* 2026-10-25 修正：原“互相包含”会被“苹果汁 ⊃ 苹果”绕过，
       现只承认归一化后完全相等（括号补充说明已被 normalizeText 去除）。 */
    return a === b;
  }

  /* ---------- R-COM-006 检测报告与申报产品比对（D14 / 评审 C2） ---------- */
  function checkReport(data, items) {
    var rName = normalizeText(data.reportProductName);
    var pName = normalizeText(data.productName);
    var rSpec = normalizeText(data.reportSpec);
    var pSpec = normalizeText(data.spec);
    // 批号：去掉分隔符后比对，"2026-08-01" 与 "20260801" 视为同一批号（评审 R8）
    var rBatch = normalizeText(data.reportBatch).replace(/[-/\\#]/g, "");
    var pBatch = normalizeText(data.batchNo).replace(/[-/\\#]/g, "");

    var hints = [];
    var lvl = null;
    var bump = function (l) {
      if (!lvl || LEVEL_ORDER[l] > LEVEL_ORDER[lvl]) { lvl = l; }
    };

    if (!sameThing(rName, pName)) {
      hints.push("报告产品名「" + data.reportProductName + "」≠ 申报产品「" + data.productName + "」");
      bump("RED");
    } else if (!sameThing(rSpec, pSpec)) {
      hints.push("报告规格「" + data.reportSpec + "」≠ 申报规格「" + data.spec + "」");
      bump("RED");
    } else if (rBatch && pBatch && rBatch !== pBatch) {
      hints.push("报告批号「" + data.reportBatch + "」≠ 包装批号「" + data.batchNo + "」，报告可能对应其他批次");
      bump("YELLOW");
    }

    if (data.reportConclusion === "不合格") {
      hints.push("报告检验结论为不合格");
      bump("RED");
    }

    if (data.reportCert === "都没有 / 不确定") {
      hints.push("报告缺 CMA/CNAS 资质标识，需人工核对出具机构资质");
      bump("YELLOW");
    }

    if (data.reportValidUntil) {
      var vu = new Date(data.reportValidUntil + "T23:59:59");
      if (!isNaN(vu.getTime()) && vu.getTime() < Date.now()) {
        hints.push("检测报告已过有效期（截至 " + data.reportValidUntil + "）");
        bump("YELLOW");
      }
    }

    if (hints.length) {
      addItem(items, "R-COM-006", hints, lvl || "YELLOW");
    }
  }

  function judge(data) {
    data = data || {};
    var type = data.type;
    var wl = (window.RULE_BASE && window.RULE_BASE.wordLists) || {};
    var items = [];

    /* 宣称文案分两处采集：包装/页面 与 直播间口播（评审 C5） */
    var CLAIM_SOURCES = [
      { label: "包装", text: data.claimText || "" },
      { label: "口播", text: data.oralClaim || "" }
    ];
    function collectHits(words) {
      var hits = [];
      CLAIM_SOURCES.forEach(function (src) {
        hitAny(src.text, words).forEach(function (w) {
          hits.push(src.label + "：" + w);
        });
      });
      return hits;
    }

    /* ---------- COM 通用：宣称文案词表命中 ---------- */
    var disease = collectHits(wl.diseaseTreatment);
    if (disease.length) { addItem(items, "R-COM-001", disease); }

    // 保健食品可依法宣传经批准的保健功能（本版无法比对 27 功能范围，故 BJ 不做该条硬判）
    var health = collectHits(wl.healthFunction);
    if (health.length && type !== "BJ") { addItem(items, "R-COM-002", health); }

    var absolute = collectHits(wl.absolute);
    if (absolute.length) { addItem(items, "R-COM-003", absolute); }

    // 虚构权威背书（命中即要求上传佐证，不预设其真伪）
    var authority = collectHits(wl.authorityClaim);
    if (authority.length) { addItem(items, "R-COM-004", authority); }

    // 承诺性效果表述 + 安全性绝对承诺（"无副作用"等，评审 R7）
    var promise = collectHits(wl.effectPromise).concat(collectHits(wl.safetyClaim));
    if (promise.length) { addItem(items, "R-COM-005", promise); }

    // 检测报告与申报产品是否一致（冒用/错配报告）
    checkReport(data, items);

    /* ---------- 各产品线字段一致性交叉 ---------- */
    if (type === "YB") {
      if (!data.scNumber) {
        /* 《食品安全法》第三十五条：生产需许可；仅销售预包装食品不需许可（需备案）。
           故经销主体缺 SC 降为黄（提示核对生产企业持证与备案），生产/自销主体仍判红。 */
        if (data.subject === "company") {
          addItem(items, "R-YB-001", [
            "未填写 SC 号；经销主体仅销售预包装食品依法不需许可（需备案），请核对 SC 是否为生产企业持有"
          ], "YELLOW");
        } else {
          addItem(items, "R-YB-001", ["SC 号为空（生产/自销主体须持食品生产许可）"], "RED");
        }
      } else {
        var sc = window.Validator.validateSC(data.scNumber);
        if (!sc.ok) { addItem(items, "R-YB-002", [sc.reason]); }
      }
      if (data.labelComplete === "缺项") { addItem(items, "R-YB-004", ["标签存在法定缺项"]); }
      if (data.nutritionLabel === "缺失") { addItem(items, "R-YB-005", ["营养成分表缺失"]); }
    } else if (type === "BJ") {
      if (data.blueHat === "无") { addItem(items, "R-BJ-001", ["未识别到蓝帽子标识"]); }
      if (!data.regNumber) { addItem(items, "R-BJ-002", ["缺少注册号/备案号"]); }
      if (data.warningText === "无") { addItem(items, "R-BJ-004", ["缺少法定警示语"]); }
    } else if (type === "NC") {
      if (data.qualifiedCert === "未提供") { addItem(items, "R-NC-001", ["未提供承诺达标合格证"]); }
      // 畜禽类须有检疫合格证明：未按规定检疫的肉类属禁止生产经营食品，判红（评审 R6）
      if (data.quarantineCert === "未提供") {
        addItem(items, "R-NC-003", ["未提供检疫合格证明（畜禽类），未按规定检疫的肉类不得销售"]);
      }
    } else if (type === "DL") {
      if (data.giAuth === "未提供") { addItem(items, "R-DL-001", ["未提供地理标志专用标志授权"]); }
      if (data.originMatch === "不一致") { addItem(items, "R-DL-002", ["产区宣称与产地不一致"]); }
    }

    /* ---------- 日期/临期校验：全产品线生效（2026-10-25 修正，原仅 YB 生效） ---------- */
    var d = window.Validator.validateProduceDate(data.produceDate, data.shelfLife);
    if (d.status === "expired") {
      addItem(items, "R-YB-006", ["已过保质期"], "RED"); // 过期由黄升红，适用于所有产品线
    } else if (d.status === "nearExpiry") {
      addItem(items, "R-YB-006", ["临期：" + d.reason]);
    } else if (d.status === "future" || d.status === "invalid") {
      addItem(items, "R-YB-006", [d.reason]);
    }

    // 聚合：取触犯规则中的最高严重等级
    var level = "GREEN";
    items.forEach(function (it) {
      var o = LEVEL_ORDER[it.level] || 1;
      if (o > LEVEL_ORDER[level]) { level = it.level; }
    });

    return { level: level, items: items, type: type };
  }

  return { judge: judge };
})();
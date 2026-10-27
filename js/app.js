/* ============================================================
   「上播前·选品体检」
   D1：分流向导（类型 → 主体 → 平台）
   D2：资料录入表单 + 本地暂存（localStorage）
   ============================================================ */

(function () {
  "use strict";

  // 当前选择状态
  var state = {
    type: null,      // NC / YB / BJ / DL
    subject: null,   // farmer / coop / company
    platform: null   // douyin / ...
  };

  // 规则线映射
  var TYPE_META = {
    NC: { name: "食用农产品", ruleLine: "食用农产品线（无需 SC，承诺达标合格证 + 检疫证明）" },
    YB: { name: "预包装食品", ruleLine: "预包装食品线（SC 证 + GB7718 标签 + GB28050 营养标签）" },
    BJ: { name: "保健食品", ruleLine: "保健食品线（蓝帽子 + 注册/备案号 + 警示语）" },
    DL: { name: "地理标志农产品", ruleLine: "地理标志线（专用标志授权 + 产地一致性）" }
  };

  var SUBJECT_META = {
    farmer: "农户自产自销",
    coop: "合作社",
    company: "企业经销"
  };

  var PLATFORM_META = {
    douyin: "抖音（抖音直播带货规则）"
  };

  // 各产品类型的资质字段定义（D2 手录版，供动态渲染）
  var SPEC_FIELDS = {
    NC: [
      { key: "qualifiedCert", label: "承诺达标合格证", type: "select", placeholder: "", options: ["已提供", "未提供"], hint: "农户/合作社主体需由生产主体开具" },
      { key: "quarantineCert", label: "检疫合格证明（畜禽类）", type: "select", placeholder: "", options: ["已提供", "未提供", "不适用（非畜禽）"], hint: "" }
    ],
    YB: [
      { key: "scNumber", label: "SC 生产许可证编号", type: "text", placeholder: "如：SC11737068200011（16 位）", hint: "SC + 14 位数字；前 3 位为食品类别码（117=水果制品）" },
      { key: "uscc", label: "统一社会信用代码", type: "text", placeholder: "18 位，如 91/92/93 开头", hint: "第 18 位校验位将本地实算（GB 32100）" },
      { key: "batchNo", label: "产品批号（包装喷码，选填）", type: "text", placeholder: "如：20260915", hint: "与检测报告批号比对，不一致会提示可能错配报告" },
      { key: "labelComplete", label: "标签完整性", type: "select", placeholder: "", options: ["完整", "缺项"], hint: "名称/配料/净含量/生产者/日期/保质期/SC/贮存条件" },
      { key: "nutritionLabel", label: "营养成分表", type: "select", placeholder: "", options: ["已提供", "缺失", "属豁免品类"], hint: "GB 28050 豁免品类除外" }
    ],
    BJ: [
      { key: "blueHat", label: "蓝帽子标识", type: "select", placeholder: "", options: ["有", "无"], hint: "保健食品专用标志" },
      { key: "regNumber", label: "注册号 / 备案号", type: "text", placeholder: "国食健字 / 卫食健字 / 食健备", hint: "" },
      { key: "warningText", label: "“本品不能代替药物”警示语", type: "select", placeholder: "", options: ["有", "无"], hint: "GB 16740-2014 标签要求" }
    ],
    DL: [
      { key: "giAuth", label: "地理标志专用标志授权证明", type: "select", placeholder: "", options: ["已提供", "未提供"], hint: "国家知识产权局公告第 354 号" },
      { key: "originMatch", label: "产区宣称与产地一致", type: "select", placeholder: "", options: ["一致", "不一致", "未宣称产区"], hint: "" }
    ]
  };

  // 各产品线"必填但为空 = 信息不足（灰）"的待补充字段（含通用项）
  // 注：SC 号 / 保健食品注册号为空已由 R-YB-001 / R-BJ-002 判红，故不在此重复
  var REQUIRED_FIELDS = {
    common: [
      { key: "productName", label: "产品名称" },
      { key: "category", label: "申报品类" }
    ],
    NC: [ { key: "qualifiedCert", label: "承诺达标合格证" } ],
    YB: [
      { key: "uscc", label: "统一社会信用代码" },
      { key: "labelComplete", label: "标签完整性" },
      { key: "nutritionLabel", label: "营养成分表" },
      { key: "produceDate", label: "生产日期" }
    ],
    BJ: [
      { key: "blueHat", label: "蓝帽子标识" },
      { key: "warningText", label: "“本品不能代替药物”警示语" }
    ],
    DL: [
      { key: "giAuth", label: "地理标志专用标志授权证明" },
      { key: "originMatch", label: "产区宣称与产地一致性" }
    ]
  };

  // ---------- DOM ----------
  var cards = Array.prototype.slice.call(document.querySelectorAll(".choice-card[data-field]"));
  var groups = {
    type: document.getElementById("group-type"),
    subject: document.getElementById("group-subject"),
    platform: document.getElementById("group-platform")
  };
  var wizard = document.getElementById("wizard");
  var entry = document.getElementById("entry");
  var summary = document.getElementById("summary");
  var summaryRules = document.getElementById("summary-rules");
  var btnNext = document.getElementById("btn-next");
  var btnReset = document.getElementById("btn-reset");
  var specFields = document.getElementById("spec-fields");
  var entryForm = document.getElementById("entry-form");
  var btnBack = document.getElementById("btn-back");
  var btnSave = document.getElementById("btn-save");
  var btnCheck = document.getElementById("btn-check");
  var saveTip = document.getElementById("save-tip");
  var verify = document.getElementById("verify");
  var verifyMeta = document.getElementById("verify-meta");
  var verifyList = document.getElementById("verify-list");
  var btnJudge = document.getElementById("btn-judge");
  var judge = document.getElementById("judge");
  var judgeBadge = document.getElementById("judge-badge");
  var judgeSummary = document.getElementById("judge-summary");
  var judgeList = document.getElementById("judge-list");
  var judgeTodo = document.getElementById("judge-todo");
  var btnReview = document.getElementById("btn-review");
  var review = document.getElementById("review");
  var reviewMeta = document.getElementById("review-meta");
  var reviewList = document.getElementById("review-list");
  var reviewVerdict = document.getElementById("review-verdict");
  var reviewSigner = document.getElementById("review-signer");
  var reviewDate = document.getElementById("review-date");
  var btnReviewCommit = document.getElementById("btn-review-commit");
  var reviewState = document.getElementById("review-state");
  var btnRules = document.getElementById("btn-rules");
  var rulesViewer = document.getElementById("rules-viewer");
  var btnRulesClose = document.getElementById("btn-rules-close");
  var rulesViewerNote = document.getElementById("rules-viewer-note");
  var rulesViewerList = document.getElementById("rules-viewer-list");
  var btnArchive = document.getElementById("btn-archive");
  var btnCsv = document.getElementById("btn-csv");
  var archive = document.getElementById("archive");
  var btnPrint = document.getElementById("btn-print");
  var archiveMask = document.getElementById("archive-mask");
  var archiveBody = document.getElementById("archive-body");
  var btnArchiveBack = document.getElementById("btn-archive-back");
  var entryHint = document.getElementById("entry-hint");
  var btnRectify = document.getElementById("btn-rectify");
  var rectify = document.getElementById("rectify");
  var rectifyBody = document.getElementById("rectify-body");
  var btnRectifyPrint = document.getElementById("btn-rectify-print");
  var btnRectifyClose = document.getElementById("btn-rectify-close");
  var ocrFileEl = document.getElementById("ocr-file");
  var ocrStatusEl = document.getElementById("ocr-status");
  var ocrKeyInput = document.getElementById("ocr-key");
  var btnOcrKeySave = document.getElementById("ocr-key-save");
  var btnDemoGreen = document.getElementById("btn-demo-green");
  var btnDemoYellow = document.getElementById("btn-demo-yellow");
  var btnDemoRed = document.getElementById("btn-demo-red");
  var btnPrivacy = document.getElementById("btn-privacy");
  var privacy = document.getElementById("privacy");
  var btnPrivacyClose = document.getElementById("btn-privacy-close");
  var btnClearData = document.getElementById("btn-clear-data");
  var reviewOwner = document.getElementById("review-owner");
  var reviewNote = document.getElementById("review-note");
  var reviewRecheck = document.getElementById("review-recheck");

  var STORAGE_KEY = "shangbobao_xuanpin_draft_v1";
  var REVIEW_KEY = "shangbobao_xuanpin_review_v1";
  var MISREPORT_KEY = "shangbobao_xuanpin_misreport_v1";
  var LEDGER_KEY = "shangbobao_xuanpin_ledger_v1";
  var OCR_KEY_STORE = "shangbobao_zhipu_key_v1";

  /* 官方核验入口（仅提供跳转，不代理查询、不联网验真） */
  var OFFICIAL_LINKS = {
    enterprise: { name: "国家企业信用信息公示系统", url: "https://www.gsxt.gov.cn/index.html" },
    sc: { name: "食品生产许可获证企业查询（总局政务平台）", url: "https://zwfw.samr.gov.cn/wyc/" },
    specialFood: { name: "特殊食品信息查询平台", url: "http://ypzsx.gsxt.gov.cn/specialfood/#/food" },
    gi: { name: "国家知识产权局（地理标志检索入口）", url: "https://www.cnipa.gov.cn/" }
  };

  // ---------- 分流事件 ----------
  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      var field = card.getAttribute("data-field");
      var value = card.getAttribute("data-value");
      if (card.disabled) { return; }
      select(field, value);
    });
  });

  btnReset.addEventListener("click", reset);
  btnNext.addEventListener("click", openEntry);

  // ---------- 录入事件 ----------
  btnBack.addEventListener("click", function () { closeEntry(); });
  btnSave.addEventListener("click", function () { saveDraft(true); });
  btnCheck.addEventListener("click", runVerify);
  btnJudge.addEventListener("click", runJudge);
  btnReview.addEventListener("click", openReview);
  btnReviewCommit.addEventListener("click", commitReview);
  btnRules.addEventListener("click", openRules);
  btnRulesClose.addEventListener("click", closeRules);
  btnArchive.addEventListener("click", openArchive);
  btnPrint.addEventListener("click", function () { printDoc("print-archive"); });
  btnArchiveBack.addEventListener("click", closeArchive);
  btnRectify.addEventListener("click", openRectify);
  btnRectifyPrint.addEventListener("click", function () { printDoc("print-rectify"); });
  btnRectifyClose.addEventListener("click", function () { rectify.hidden = true; });
  btnCsv.addEventListener("click", exportLedgerCsv);
  archiveMask.addEventListener("change", function () {
    if (currentArchive) { renderArchive(currentArchive, archiveMask.checked); }
  });

  // OCR 通道事件（D8）
  btnOcrKeySave.addEventListener("click", saveOcrKey);
  ocrFileEl.addEventListener("change", function () {
    handleOcrUpload(ocrFileEl.files && ocrFileEl.files[0]);
  });
  if (getOcrKey()) { setOcrStatus("已配置识别密钥，可直接上传图片识别。", "ok"); }

  // D10：演示模式 + 隐私说明 + 清除数据
  btnDemoGreen.addEventListener("click", function () { loadDemo("green"); });
  btnDemoYellow.addEventListener("click", function () { loadDemo("yellow"); });
  btnDemoRed.addEventListener("click", function () { loadDemo("red"); });
  btnPrivacy.addEventListener("click", openPrivacy);
  btnPrivacyClose.addEventListener("click", closePrivacy);
  btnClearData.addEventListener("click", clearAllData);

  // 通用输入 + 动态输入统一收集
  entryForm.addEventListener("input", function () {
    saveDraft(false); // 静默暂存，不提示
  });

  // ---------- 分流向导逻辑 ----------
  function select(field, value) {
    state[field] = value;

    cards.forEach(function (c) {
      if (c.getAttribute("data-field") === field) {
        c.classList.toggle("is-selected", c.getAttribute("data-value") === value);
      }
    });

    unlockNext(field);
    renderSummary();
  }

  function unlockNext(field) {
    if (field === "type" && state.type) {
      groups.subject.disabled = false;
    }
    if (field === "subject" && state.subject) {
      groups.platform.disabled = false;
    }
  }

  function renderSummary() {
    if (!state.type || !state.subject || !state.platform) {
      summary.hidden = true;
      btnNext.disabled = true;
      return;
    }

    var t = TYPE_META[state.type];
    var rules = [
      { k: "产品类型", v: t.name },
      { k: "销售主体", v: SUBJECT_META[state.subject] },
      { k: "带货平台", v: PLATFORM_META[state.platform] },
      { k: "适用规则线", v: t.ruleLine }
    ];

    summaryRules.innerHTML = "";
    rules.forEach(function (r) {
      var chip = document.createElement("span");
      chip.className = "rule-chip";
      chip.innerHTML = r.k + "：<b>" + r.v + "</b>";
      summaryRules.appendChild(chip);
    });

    summary.hidden = false;
    btnNext.disabled = false;
  }

  function reset() {
    state = { type: null, subject: null, platform: null };
    cards.forEach(function (c) { c.classList.remove("is-selected"); });
    groups.subject.disabled = true;
    groups.platform.disabled = true;
    summary.hidden = true;
    closeEntry();

    // 重新分流时清空上一单的核验/判定/审核/档案界面状态，避免旧结论残留（评审 C13）
    reviewItems = [];
    lastVerify = [];
    verify.hidden = true;
    judge.hidden = true;
    review.hidden = true;
    reviewState.hidden = true;
    rectify.hidden = true;
    archive.hidden = true;
    if (reviewOwner) { reviewOwner.value = ""; }
    if (reviewNote) { reviewNote.value = ""; }
    if (reviewRecheck) { reviewRecheck.checked = false; }
    if (reviewSigner) { reviewSigner.value = ""; }
    if (reviewVerdict) { reviewVerdict.value = ""; }

    groups.type.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- 录入页 ----------
  function openEntry() {
    wizard.hidden = true;
    entry.hidden = false;
    renderSpecFields();
    setStep(2);
    loadDraft();
    setEntryHint("填写以上信息后，点击「证据核验」开始核验（关键字段须人工确认）。");
    entry.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeEntry() {
    entry.hidden = true;
    wizard.hidden = false;
    setStep(1);
  }

  function setStep(n) {
    Array.prototype.forEach.call(document.querySelectorAll(".stepper__item"), function (item) {
      var s = Number(item.getAttribute("data-step"));
      item.classList.toggle("is-active", s === n);
      item.classList.toggle("is-done", s < n);
    });
  }

  function setEntryHint(text, kind) {
    if (!entryHint) { return; }
    entryHint.textContent = text;
    entryHint.className = "entry-hint" + (kind ? " entry-hint--" + kind : "");
  }

  // 按产品类型动态渲染资质字段
  function renderSpecFields() {
    specFields.innerHTML = "";
    var fields = SPEC_FIELDS[state.type] || [];
    fields.forEach(function (f) {
      var label = document.createElement("label");
      label.className = "field";
      label.innerHTML =
        '<span class="field__label">' + f.label + '</span>' +
        (f.type === "select"
          ? buildSelect(f)
          : '<input class="field__input" type="text" data-key="' + f.key + '" placeholder="' + (f.placeholder || "") + '" />');
      if (f.hint) {
        label.innerHTML += '<span class="field__hint">' + f.hint + '</span>';
      }
      specFields.appendChild(label);
    });
  }

  function buildSelect(f) {
    var html = '<select class="field__input" data-key="' + f.key + '">';
    html += '<option value="">— 请选择 —</option>';
    (f.options || []).forEach(function (o) {
      html += '<option value="' + o + '">' + o + '</option>';
    });
    html += '</select>';
    return html;
  }

  // ---------- 本地暂存 ----------
  function collectForm() {
    var data = { type: state.type, subject: state.subject, platform: state.platform };
    entryForm.querySelectorAll("[data-key]").forEach(function (el) {
      data[el.getAttribute("data-key")] = el.value;
    });
    return data;
  }

  function saveDraft(showTip) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectForm()));
      if (showTip) {
        saveTip.hidden = false;
        setTimeout(function () { saveTip.hidden = true; }, 2200);
      }
    } catch (e) {
      // localStorage 不可用（隐私模式/配额），静默降级：仅本次会话有效
    }
  }

  function loadDraft() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    if (!raw) { return; }

    // 仅当草稿类型与当前分流一致时才回填，避免类型错位
    var draft = null;
    try { draft = JSON.parse(raw); } catch (e) { return; }
    if (!draft || draft.type !== state.type) { return; }

    entryForm.querySelectorAll("[data-key]").forEach(function (el) {
      var key = el.getAttribute("data-key");
      if (draft[key] !== undefined && draft[key] !== null) {
        el.value = draft[key];
      }
    });
  }

  // ---------- 证据核验（D3） ----------
  function runVerify() {
    var data = collectForm();
    var items = [];

    // 生产日期 / 保质期（各类型通用）
    items.push({ label: "生产日期 / 保质期", res: window.Validator.validateProduceDate(data.produceDate, data.shelfLife) });

    if (state.type === "NC") {
      items.push({ label: "SC 生产许可证", res: { ok: null, reason: "食用农产品无需 SC 证，跳过该项（避免误判）" } });
      items.push({ label: "承诺达标合格证 / 检疫证明", res: { ok: null, reason: "文本证照类，需人工核对原件与畜禽检疫证明" } });
    } else if (state.type === "YB") {
      items.push({ label: "SC 生产许可证编号", res: window.Validator.validateSC(data.scNumber), links: [OFFICIAL_LINKS.sc] });
      items.push({ label: "统一社会信用代码", res: window.Validator.validateUSCC(data.uscc), links: [OFFICIAL_LINKS.enterprise] });
    } else if (state.type === "BJ") {
      items.push({ label: "注册号 / 备案号", res: { ok: null, reason: "无本地校验算法，需对照“特殊食品信息查询平台”人工核对" }, links: [OFFICIAL_LINKS.specialFood] });
    } else if (state.type === "DL") {
      items.push({ label: "地理标志专用标志授权", res: { ok: null, reason: "授权证明为文本证照，需人工核对授权书与产地一致性" }, links: [OFFICIAL_LINKS.gi] });
    }

    renderVerify(data, items);
    lastVerify = items.map(function (it) {
      var status = it.res.ok === true ? "通过" : (it.res.ok === false ? "需修正" : "人工核对");
      return it.label + "：" + status;
    });
    verify.hidden = false;
    setStep(3);
    setEntryHint("核验完成。有「需修正」项请先核对修正，再点击「规则判定」查看判定结果。", "ok");
    verify.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderVerify(data, items) {
    var passed = items.filter(function (i) { return i.res.ok === true; }).length;
    var failed = items.filter(function (i) { return i.res.ok === false; }).length;
    var manual = items.filter(function (i) { return i.res.ok !== true && i.res.ok !== false; }).length;

    verifyMeta.textContent =
      "核验对象：" + (data.productName || "（未填写产品名称）") +
      " · 共 " + items.length + " 项：通过 " + passed + "、需修正 " + failed + "、人工核对 " + manual +
      " · 本地只做结构校验，官方入口仅跳转、不代查。";

    verifyList.innerHTML = "";
    items.forEach(function (it) {
      var r = it.res;
      var status = r.ok === true ? "ok" : (r.ok === false ? "fail" : "manual");
      var card = document.createElement("div");
      card.className = "verify-item verify-item--" + status;
      var linksHtml = "";
      /* 官方核验留痕：结果 + 日期，随档案保存（评审 R10） */
      var officialHtml = "";
      if (it.links && it.links.length) {
        linksHtml = '<p class="verify-item__links">官方核验入口（仅跳转，不代查）：' +
          it.links.map(function (l) {
            return '<a href="' + escapeHtml(l.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(l.name) + '</a>';
          }).join(" · ") + '</p>';
        officialHtml =
          '<div class="verify-item__official" data-label="' + escapeHtml(it.label) + '">' +
            '<span class="verify-item__official-label">在官方平台核对后留痕：</span>' +
            '<select class="verify-item__official-result">' +
              '<option value="">未核验</option>' +
              '<option value="一致">已核对·一致</option>' +
              '<option value="不符">已核对·不符</option>' +
            '</select>' +
            '<input class="verify-item__official-date" type="date" aria-label="官方核验日期" />' +
          '</div>';
      }
      card.innerHTML =
        '<div class="verify-item__head">' +
          '<span class="verify-item__label">' + it.label + '</span>' +
          '<span class="verify-item__tag">' + (status === "ok" ? "通过" : status === "fail" ? "需修正" : "人工核对") + '</span>' +
        '</div>' +
        '<p class="verify-item__reason">' + (r.reason || "") + '</p>' +
        linksHtml + officialHtml;
      verifyList.appendChild(card);
    });

    verifyList.querySelectorAll(".verify-item__official-result").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var dt = sel.parentNode.querySelector(".verify-item__official-date");
        if (sel.value && dt && !dt.value) { dt.value = dateOffset(0); }
      });
    });
  }

  /* 读取第 3 步的官方核验留痕（未选择的项不记录） */
  function readOfficialChecks() {
    var out = [];
    verifyList.querySelectorAll(".verify-item__official").forEach(function (box) {
      var sel = box.querySelector(".verify-item__official-result");
      var dt = box.querySelector(".verify-item__official-date");
      if (sel && sel.value) {
        out.push({
          label: box.getAttribute("data-label") || "",
          result: sel.value,
          date: (dt && dt.value) || ""
        });
      }
    });
    return out;
  }

  // ---------- 规则判定（D4/D5） ----------
  function runJudge() {
    if (verify.hidden) {
      if (!window.confirm("尚未执行第 3 步「证据核验」，建议先核验再判定。是否仍直接进行规则判定？")) { return; }
    }
    var data = collectForm();
    var result = window.Engine.judge(data);
    var missing = computeMissing();
    renderJudge(data, result, missing);
    judge.hidden = false;
    setStep(4);
    setEntryHint("判定完成。请点击「进入人工审核」，逐条裁决并签字生效。", "ok");
    judge.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function computeMissing() {
    var data = collectForm();
    var missing = [];
    (REQUIRED_FIELDS.common || []).concat(REQUIRED_FIELDS[state.type] || []).forEach(function (f) {
      if (!data[f.key]) { missing.push(f.label); }
    });
    return missing;
  }

  function renderJudge(data, result, missing) {
    // 无硬性违规但关键字段缺失 → 灰·信息不足（不误判为"可播"）
    var displayLevel = (result.level === "GREEN" && missing.length > 0) ? "GRAY" : result.level;
    var lv = (window.RULE_BASE && window.RULE_BASE.judgeLevels && window.RULE_BASE.judgeLevels[displayLevel]) || {};
    judgeBadge.className = "judge__badge judge__badge--" + String(displayLevel).toLowerCase();
    judgeBadge.textContent = lv.name || displayLevel;

    judgeSummary.textContent =
      "判定对象：" + (data.productName || "（未填写产品名称）") +
      " · 触犯规则 " + result.items.length + " 条" +
      (missing.length ? " · 待补充 " + missing.length + " 项" : "") +
      (lv.meaning ? " · " + lv.meaning : "") + "。";

    judgeList.innerHTML = "";
    if (result.items.length === 0) {
      var empty = document.createElement("p");
      empty.className = missing.length ? "judge__pass judge__pass--gray" : "judge__pass";
      empty.textContent = missing.length
        ? "未触犯硬性违规规则，但关键信息缺失，请补充后重新判定。"
        : "未触犯任何启用中的硬规则。";
      judgeList.appendChild(empty);
    } else {
      result.items.forEach(renderJudgeItem);
    }

    if (missing.length > 0) {
      judgeTodo.hidden = false;
      judgeTodo.innerHTML =
        '<h4 class="judge-todo__title">待补充材料 / 信息清单（灰·信息不足）</h4>' +
        '<ul class="judge-todo__list">' +
        missing.map(function (m) { return "<li>" + m + "</li>"; }).join("") +
        "</ul>";
    } else {
      judgeTodo.hidden = true;
    }

    // 整改单入口只在黄·整改态出现（红为禁播说明、绿/灰无需整改）
    btnRectify.hidden = displayLevel !== "YELLOW";
    rectify.hidden = true;
  }

  // ---------- 整改单（D13） ----------
  function printDoc(cls) {
    document.body.classList.add(cls);
    var clear = function () { document.body.classList.remove(cls); };
    window.addEventListener("afterprint", clear);
    window.print();
    setTimeout(clear, 800);
  }

  function openRectify() {
    var data = collectForm();
    var result = window.Engine.judge(data);
    var missing = computeMissing();
    if (result.level !== "YELLOW") {
      alert("当前判定不是「黄·整改」，无需出具整改单。");
      return;
    }
    renderRectify(data, result, missing);
    rectify.hidden = false;
    setStep(4);
    rectify.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderRectify(data, result, missing) {
    var now = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var no = "ZG-" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" +
      pad(now.getHours()) + pad(now.getMinutes());

    var rows = result.items.map(function (it, i) {
      var r = it.rule || {};
      var b = r.basis || {};
      return "<tr>" +
        "<td>" + (i + 1) + "</td>" +
        "<td>" + escapeHtml(r.id) + "</td>" +
        "<td>" + escapeHtml(r.name) +
          "<br><span class='rectify__sub'>命中：" + escapeHtml((it.hints || []).join("、") || "—") + "</span></td>" +
        "<td><span class='tag-level tag-level--" + String(it.level).toLowerCase() + "'>" + escapeHtml(it.level) + "</span></td>" +
        "<td>" + escapeHtml(r.risk_note || "") + "</td>" +
        "<td>" + escapeHtml(r.action || "") + "</td>" +
        "<td>" + escapeHtml(b.law || "") + (b.note ? "<br><span class='rectify__sub'>" + escapeHtml(b.note) + "</span>" : "") + "</td>" +
        "</tr>";
    }).join("");

    var missingHtml = missing.length
      ? "<ul class='rectify__list'>" + missing.map(function (m) { return "<li>" + escapeHtml(m) + "</li>"; }).join("") + "</ul>"
      : "<p class='archive__empty'>无。</p>";

    rectifyBody.innerHTML =
      '<div class="archive__doc" id="rectify-doc">' +
        '<h3 class="archive__doc-title">直播选品整改单</h3>' +
        '<p class="archive__doc-sub">整改单编号 ' + escapeHtml(no) + ' · 出具日期 ' + now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + ' · 判定等级 <b>黄·整改</b></p>' +

        '<h4 class="archive__sec">一、选品基本信息</h4>' +
        '<table class="archive__table"><tbody>' +
          "<tr><th>产品名称</th><td>" + escapeHtml(data.productName || "（未填写）") + "</td></tr>" +
          "<tr><th>申报品类</th><td>" + escapeHtml(data.category || "（未填写）") + "</td></tr>" +
          "<tr><th>生产者/生产企业</th><td>" + escapeHtml(data.producer || "（未填写）") + "</td></tr>" +
          "<tr><th>产地/生产地址</th><td>" + escapeHtml(data.origin || "（未填写）") + "</td></tr>" +
          "<tr><th>分流</th><td>" +
            escapeHtml((TYPE_META[state.type] && TYPE_META[state.type].name) || state.type) + " / " +
            escapeHtml(SUBJECT_META[state.subject] || state.subject) + " / " +
            escapeHtml(PLATFORM_META[state.platform] || state.platform) +
          "</td></tr>" +
        "</tbody></table>" +

        '<h4 class="archive__sec">二、需整改问题清单（共 ' + result.items.length + ' 项）</h4>' +
        '<table class="archive__table archive__table--wide"><thead><tr>' +
          "<th>#</th><th>规则ID</th><th>问题</th><th>等级</th><th>风险说明</th><th>整改要求</th><th>依据</th>" +
        "</tr></thead><tbody>" + rows + "</tbody></table>" +

        '<h4 class="archive__sec">三、需补充材料</h4>' + missingHtml +

        '<h4 class="archive__sec">四、整改要求</h4>' +
        '<p class="archive__text">1. 请在上表"整改要求"列指引下完成修改，并保留修改前后对照（截图或文档）。<br>' +
        '2. 整改完成后重新提交本工具体检，取得「绿·可播」判定后方可上播。<br>' +
        '3. 整改期限：自本单出具之日起 <b>7 个自然日</b> 内完成。</p>' +

        '<h4 class="archive__sec">五、签收</h4>' +
        '<p class="archive__text">整改责任方：________________　　复核人（选品/合规）：________________　　签收日期：______年__月__日</p>' +

        '<p class="archive__disclaimer">本整改单由「上播前·选品体检」本地生成，所列依据来自人工编审的规则库，条款号【待核对】项须由合规人员最终确认；仅供内部整改使用，不构成法律意见。</p>' +
      "</div>";
  }

  function renderJudgeItem(it) {
    var r = it.rule;
    var basis = r.basis || {};
    var rows = "";
    if (basis.law) { rows += '<div><dt>法规依据</dt><dd>' + basis.law + (basis.note ? "（" + basis.note + "）" : "") + '</dd></div>'; }
    if (r.action) { rows += '<div><dt>整改动作</dt><dd>' + r.action + '</dd></div>'; }
    if (r.risk_note) { rows += '<div><dt>风险提示</dt><dd>' + r.risk_note + '</dd></div>'; }
    if (r.source) { rows += '<div><dt>来源</dt><dd>' + r.source + '</dd></div>'; }

    var card = document.createElement("div");
    card.className = "judge-item judge-item--" + String(it.level).toLowerCase();
    card.innerHTML =
      '<div class="judge-item__head">' +
        '<span class="judge-item__id">' + r.id + '</span>' +
        '<span class="judge-item__name">' + r.name + '</span>' +
        '<span class="judge-item__tag">' + it.level + '</span>' +
      '</div>' +
      '<p class="judge-item__hits">命中：' + (it.hints && it.hints.length ? it.hints.join("、") : "—") + '</p>' +
      '<details class="judge-item__detail">' +
        '<summary>查看依据</summary>' +
        '<dl class="judge-item__basis">' + rows + '</dl>' +
      '</details>';
    judgeList.appendChild(card);
  }

  // ---------- 人工审核台（D6） ----------
  var reviewItems = [];
  var lastVerify = [];

  function openReview() {
    if (judge.hidden) {
      if (!window.confirm("尚未执行第 4 步「规则判定」，建议先判定再审核。是否仍直接进入人工审核？")) { return; }
    }
    var data = collectForm();
    var result = window.Engine.judge(data);
    var missing = computeMissing();
    reviewItems = result.items.map(function (it) {
      return { ruleId: it.rule.id, name: it.rule.name, level: it.level, verdict: "" };
    });

    reviewMeta.textContent =
      "审核对象：" + (data.productName || "（未填写产品名称）") +
      " · 待裁决 " + reviewItems.length + " 条" +
      (missing.length ? "（另有待补充 " + missing.length + " 项）" : "") +
      " · 请逐条裁决并签字生效。";

    renderReviewList();
    reviewState.hidden = true;
    setReviewLocked(false);
    review.hidden = false;
    setStep(5);
    review.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderReviewList() {
    reviewList.innerHTML = "";
    if (reviewItems.length === 0) {
      var p = document.createElement("p");
      p.className = "review__empty";
      p.textContent = "无硬性违规条目，可直接出具审核结论。";
      reviewList.appendChild(p);
      return;
    }

    reviewItems.forEach(function (it, idx) {
      var row = document.createElement("div");
      row.className = "review-item review-item--" + it.level.toLowerCase();
      row.innerHTML =
        '<div class="review-item__head">' +
          '<span class="review-item__id">' + it.ruleId + '</span>' +
          '<span class="review-item__name">' + it.name + '</span>' +
          '<span class="review-item__tag">' + it.level + '</span>' +
        '</div>' +
        '<div class="review-item__action">' +
          '<label class="review-item__label">裁决</label>' +
          '<select class="review-item__verdict" data-idx="' + idx + '">' +
            '<option value="">— 请选择 —</option>' +
            '<option value="confirmed">确认违规</option>' +
            '<option value="misreport">标记误报</option>' +
            '<option value="ignore">忽略</option>' +
          '</select>' +
        '</div>';
      reviewList.appendChild(row);
    });

    reviewList.querySelectorAll(".review-item__verdict").forEach(function (sel) {
      sel.addEventListener("change", function () {
        reviewItems[Number(sel.getAttribute("data-idx"))].verdict = sel.value;
      });
    });
  }

  function commitReview() {
    var overall = reviewVerdict.value;
    var signer = reviewSigner.value.trim();
    var date = reviewDate.value;
    if (!overall) { alert("请选择审核结论"); return; }
    if (!signer) { alert("请填写审核人姓名（签字）"); return; }
    if (!date) { alert("请选择审核日期"); return; }

    for (var i = 0; i < reviewItems.length; i++) {
      if (!reviewItems[i].verdict) { alert("请为每条判定作出裁决（第 " + (i + 1) + " 条）"); return; }
    }

    // 红灯却选"通过"：二次警示（2026-10-25 评审 C7）
    var hasRed = reviewItems.some(function (it) { return it.level === "RED"; });
    if (hasRed && overall.indexOf("通过") !== -1) {
      if (!window.confirm(
        "本次判定含「红·禁播」条目，但审核结论选择了「" + overall + "」。\n" +
        "这属于高风险决定，建议改为「禁播」。是否仍要签字生效？")) { return; }
    }

    // 官方平台核对为「不符」却选"通过"：同样二次警示（评审 R10）
    var official = readOfficialChecks();
    var mismatch = official.filter(function (x) { return x.result === "不符"; });
    if (mismatch.length && overall.indexOf("通过") !== -1) {
      if (!window.confirm(
        "官方平台核对存在「不符」记录：" + mismatch.map(function (x) { return x.label; }).join("、") + "。\n" +
        "审核结论却选择了「" + overall + "」。是否仍要签字生效？")) { return; }
    }

    var now = new Date();
    var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
    var archiveNo = "DA-" + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) +
      "-" + pad2(now.getHours()) + pad2(now.getMinutes());

    var data = collectForm();
    var archive = {
      archiveNo: archiveNo,
      reviewedAt: now.toISOString(),
      ruleVersion: (window.RULE_BASE && window.RULE_BASE.meta) ? window.RULE_BASE.meta.version : "?",
      ruleUpdated: (window.RULE_BASE && window.RULE_BASE.meta) ? window.RULE_BASE.meta.updated : "?",
      verify: lastVerify.slice(),
      official: official,
      signer: signer,
      date: date,
      owner: (reviewOwner && reviewOwner.value.trim()) || "",
      reviewNote: (reviewNote && reviewNote.value.trim()) || "",
      needRecheck: !!(reviewRecheck && reviewRecheck.checked),
      verdict: overall,
      flow: { type: state.type, subject: state.subject, platform: state.platform },
      form: data,
      reviewItems: reviewItems,
      missing: computeMissing()
    };

    try {
      localStorage.setItem(REVIEW_KEY, JSON.stringify(archive));

      // 台账：每次签字都追加一条，供 CSV 汇总导出（2026-10-25 评审 C8）
      try {
        var ledger = JSON.parse(localStorage.getItem(LEDGER_KEY)) || [];
        ledger.push({
          no: archiveNo,
          date: date,
          signer: signer,
          product: data.productName || "",
          category: data.category || "",
          type: state.type,
          subject: state.subject,
          verdict: overall,
          ruleCount: reviewItems.length,
          ruleIds: reviewItems.map(function (x) { return x.ruleId; }).join(" "),
          missingCount: archive.missing.length,
          ruleVersion: archive.ruleVersion
        });
        if (ledger.length > 500) { ledger = ledger.slice(ledger.length - 500); }
        localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
      } catch (e2) { /* 台账失败不阻断签字 */ }

      var misreports = reviewItems.filter(function (it) { return it.verdict === "misreport"; });
      if (misreports.length) {
        var log = [];
        try { log = JSON.parse(localStorage.getItem(MISREPORT_KEY)) || []; } catch (e) { log = []; }
        misreports.forEach(function (m) {
          log.push({ ruleId: m.ruleId, name: m.name, when: date, signer: signer });
        });
        localStorage.setItem(MISREPORT_KEY, JSON.stringify(log));
      }
    } catch (e) { /* localStorage 不可用则本次会话有效 */ }

    setReviewLocked(true);
    reviewState.hidden = false;
    reviewState.innerHTML =
      "<b>已签字生效</b> · " + signer + " · " + date + " · 结论：" + overall +
      " · 已写入本地档案（误报 " + reviewItems.filter(function (x) { return x.verdict === "misreport"; }).length + " 条沉淀）。";
    reviewState.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function setReviewLocked(locked) {
    reviewVerdict.disabled = locked;
    reviewSigner.disabled = locked;
    reviewDate.disabled = locked;
    btnReviewCommit.disabled = locked;
    reviewList.querySelectorAll(".review-item__verdict").forEach(function (sel) { sel.disabled = locked; });
  }

  // ---------- 规则库查看（D7） ----------
  function openRules() {
    renderRules();
    rulesViewer.hidden = false;
    rulesViewer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeRules() {
    rulesViewer.hidden = true;
  }

  function renderRules() {
    var RB = window.RULE_BASE || {};
    var allRules = RB.rules || [];
    // 已入库但尚未接入引擎判定的规则（查看页需如实标注，避免"21 条都生效"的误解）
    var DISABLED_RULES = ["R-YB-003", "R-BJ-003", "R-NC-002"];
    var disabledCount = allRules.filter(function (r) { return DISABLED_RULES.indexOf(r.id) !== -1; }).length;

    rulesViewerNote.textContent =
      "共 " + allRules.length + " 条规则 · 已启用 " + (allRules.length - disabledCount) +
      " 条 · 未启用 " + disabledCount + " 条（标“未启用”者需对照表或人工裁决） · " +
      (RB.meta ? RB.meta.redLine : "") + " · 版本 v" + (RB.meta ? RB.meta.version : "?") +
      " · 更新 " + (RB.meta ? RB.meta.updated : "?") +
      " · 状态：" + (RB.meta ? RB.meta.status : "草案");

    var lvName = RB.judgeLevels || {};
    rulesViewerList.innerHTML = "";
    allRules.forEach(function (r) {
      var lv = lvName[r.level] ? lvName[r.level].name : r.level;
      var isOff = DISABLED_RULES.indexOf(r.id) !== -1;
      var card = document.createElement("div");
      card.className = "rules-card" + (isOff ? " rules-card--off" : "");
      card.innerHTML =
        '<div class="rules-card__head">' +
          '<span class="rules-card__id">' + escapeHtml(r.id) + '</span>' +
          '<span class="rules-card__name">' + escapeHtml(r.name) + '</span>' +
          '<span class="rules-card__cat">' + escapeHtml(r.category) + '</span>' +
          '<span class="tag-level tag-level--' + String(r.level).toLowerCase() + '">' + escapeHtml(lv) + '</span>' +
          (isOff ? '<span class="rules-card__off">未启用</span>' : '') +
        '</div>' +
        '<p class="rules-card__trigger">触发：' + escapeHtml(r.trigger) + '</p>' +
        '<p class="rules-card__basis">依据：' + escapeHtml((r.basis && r.basis.law) || "") + (r.basis && r.basis.note ? "（" + escapeHtml(r.basis.note) + "）" : "") + '</p>' +
        '<p class="rules-card__action">整改：' + escapeHtml(r.action || "") + '</p>' +
        '<p class="rules-card__meta">来源：' + escapeHtml(r.source || "") + ' · 引擎：' + escapeHtml(r.engine || "") + (isOff ? ' · 状态：未接入判定引擎' : '') + '</p>';
      rulesViewerList.appendChild(card);
    });
  }

  // ---------- 体检档案导出（D7） ----------
  var FIELD_LABELS = {
    productName: "产品名称", category: "申报品类", producer: "生产者/生产企业",
    origin: "产地/生产地址", spec: "净含量/规格", produceDate: "生产日期",
    shelfLife: "保质期", claimText: "包装/页面文案", oralClaim: "直播间口播稿",
    scNumber: "SC 生产许可证编号", uscc: "统一社会信用代码", batchNo: "产品批号",
    labelComplete: "标签完整性", nutritionLabel: "营养成分表",
    qualifiedCert: "承诺达标合格证", quarantineCert: "检疫合格证明",
    blueHat: "蓝帽子标识", regNumber: "注册号/备案号", warningText: "“本品不能代替药物”警示语",
    giAuth: "地理标志专用标志授权证明", originMatch: "产区宣称与产地一致性",
    reportNo: "检测报告编号", reportProductName: "报告上的产品名称",
    reportSpec: "报告上的规格", reportBatch: "报告上的批号",
    reportCert: "CMA/CNAS 标识", reportConclusion: "报告检验结论",
    reportValidUntil: "报告有效期至"
  };
  var SENSITIVE_KEYS = ["producer", "uscc", "scNumber", "regNumber", "reportNo"];
  var VERDICT_LABELS = { confirmed: "确认违规", misreport: "标记误报", ignore: "忽略" };
  var currentArchive = null;

  function openArchive() {
    var raw = null;
    try { raw = localStorage.getItem(REVIEW_KEY); } catch (e) { raw = null; }
    if (!raw) { alert("请先完成第 5 步人工审核并签字生效，再导出档案。"); return; }
    try { currentArchive = JSON.parse(raw); } catch (e) { alert("档案数据读取失败，请重新审核。"); return; }

    // 防止导错档案：本地档案与当前录入的商品/类型不一致时先提示（D11 回归发现）
    var nowName = (collectForm().productName || "").trim();
    var savedName = ((currentArchive.form && currentArchive.form.productName) || "").trim();
    var typeChanged = !!(currentArchive.flow && currentArchive.flow.type !== state.type);
    if (typeChanged || (nowName && savedName && nowName !== savedName)) {
      if (!window.confirm(
        "本地档案属于「" + (savedName || "（未命名商品）") + "」，与当前录入的「" +
        (nowName || "（未填写）") + "」不一致。\n" +
        "是否仍查看该档案？建议重新完成人工审核后再导出。")) { return; }
    }

    renderArchive(currentArchive, archiveMask.checked);
    archive.hidden = false;
    setStep(6);
    archive.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeArchive() {
    archive.hidden = true;
  }

  /* ---------- CSV 台账导出（C8） ---------- */
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/[",\r\n]/.test(s)) { return '"' + s.replace(/"/g, '""') + '"'; }
    return s;
  }

  function exportLedgerCsv() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(LEDGER_KEY)) || []; } catch (e) { list = []; }
    if (!list.length) {
      alert("暂无台账记录。请先完成一次人工审核并签字生效，再导出。");
      return;
    }

    var TYPE_NAME = { NC: "食用农产品", YB: "预包装食品", BJ: "保健食品", DL: "地理标志农产品" };
    var head = ["档案编号", "审核日期", "审核人", "产品名称", "申报品类", "产品类型", "销售主体", "审核结论", "命中规则数", "命中规则ID", "待补充数", "规则库版本"];
    var rows = list.map(function (r) {
      return [
        r.no, r.date, r.signer, r.product, r.category,
        TYPE_NAME[r.type] || r.type,
        SUBJECT_META[r.subject] || r.subject,
        r.verdict, r.ruleCount, r.ruleIds || "", r.missingCount || 0,
        "v" + (r.ruleVersion || "?")
      ];
    });
    var csv = [head].concat(rows).map(function (row) {
      return row.map(csvCell).join(",");
    }).join("\r\n");

    var now = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var stamp = "" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
    var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "选品体检台账_" + stamp + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* 官方核验留痕文字化（旧档案无该字段时给出诚实缺省） */
  function formatOfficial(list) {
    if (!list || !list.length) { return "未记录（本地仅做结构校验，官方入口由人工跳转核对）"; }
    return list.map(function (x) {
      return x.label + "—" + x.result + (x.date ? "（" + x.date + "）" : "");
    }).join("；");
  }

  function maskValue(key, val, masked) {
    if (!masked || SENSITIVE_KEYS.indexOf(key) === -1 || !val) { return val; }
    var s = String(val);
    if (s.length <= 4) { return "***"; }
    return s.slice(0, 2) + "***" + s.slice(-2);
  }

  function renderArchive(a, masked) {
    var t = TYPE_META[a.flow.type] || {};
    // 分流信息已在「一、分流信息」单独成段，不再混入录入资料表格（D12 案例留证发现）
    var FLOW_KEYS = ["type", "subject", "platform"];
    var rows = Object.keys(a.form || {}).filter(function (k) {
      return FLOW_KEYS.indexOf(k) === -1;
    }).map(function (k) {
      var v = (a.form[k] === undefined || a.form[k] === null || a.form[k] === "") ? "（未填写）" : a.form[k];
      return "<tr><th>" + escapeHtml(FIELD_LABELS[k] || k) + "</th><td>" +
        escapeHtml(maskValue(k, v, masked)) + "</td></tr>";
    }).join("");

    var items = (a.reviewItems || []).map(function (it, i) {
      var v = VERDICT_LABELS[it.verdict] || "未裁决";
      return "<tr><td>" + (i + 1) + "</td><td>" + escapeHtml(it.ruleId) + "</td><td>" +
        escapeHtml(it.name) + "</td><td><span class='tag-level tag-level--" + String(it.level).toLowerCase() + "'>" +
        escapeHtml(it.level) + "</span></td><td>" + escapeHtml(v) + "</td></tr>";
    }).join("");

    var missing = (a.missing || []).map(function (m) { return "<li>" + escapeHtml(m) + "</li>"; }).join("");

    archiveBody.innerHTML =
      '<div class="archive__doc" id="archive-doc">' +
        '<h3 class="archive__doc-title">选品体检档案</h3>' +
        '<p class="archive__doc-sub">档案编号 ' + escapeHtml(a.archiveNo || a.reviewedAt) +
          ' · 规则库 v' + escapeHtml(a.ruleVersion || "?") + '（依据截至 ' + escapeHtml(a.ruleUpdated || "?") + '）' +
          ' · 审核日期 ' + escapeHtml(a.date) + ' · 审核人 ' + escapeHtml(masked ? "***" : a.signer) + '</p>' +

        '<h4 class="archive__sec">一、分流信息</h4>' +
        '<p class="archive__flow">' +
          '产品类型：' + escapeHtml(t.name || a.flow.type) +
          '　销售主体：' + escapeHtml(SUBJECT_META[a.flow.subject] || a.flow.subject) +
          '　带货平台：' + escapeHtml(PLATFORM_META[a.flow.platform] || a.flow.platform) +
          '<br>适用规则线：' + escapeHtml((TYPE_META[a.flow.type] && TYPE_META[a.flow.type].ruleLine) || "") +
          '<br>证据核验：' + escapeHtml((a.verify && a.verify.length) ? a.verify.join("；") : "未执行证据核验") +
          '<br>官方核验：' + escapeHtml(formatOfficial(a.official)) +
        '</p>' +

        '<h4 class="archive__sec">二、录入资料</h4>' +
        '<table class="archive__table"><tbody>' + rows + '</tbody></table>' +

        '<h4 class="archive__sec">三、判定明细与裁决</h4>' +
        (items
          ? '<table class="archive__table"><thead><tr><th>#</th><th>规则ID</th><th>规则名</th><th>等级</th><th>裁决</th></tr></thead><tbody>' + items + '</tbody></table>'
          : '<p class="archive__empty">无硬性违规条目。</p>') +

        '<h4 class="archive__sec">四、待补充清单</h4>' +
        (missing ? '<ul class="archive__missing">' + missing + '</ul>' : '<p class="archive__empty">无。</p>') +

        '<h4 class="archive__sec">五、审核结论</h4>' +
        '<p class="archive__verdict">结论：<b>' + escapeHtml(a.verdict) + '</b>　审核人：' + escapeHtml(masked ? "***" : a.signer) + '　日期：' + escapeHtml(a.date) + '</p>' +
        (a.owner ? '<p class="archive__verdict">整改责任人：' + escapeHtml(masked ? "***" : a.owner) + '</p>' : '') +
        (a.reviewNote ? '<p class="archive__verdict">审核备注：' + escapeHtml(a.reviewNote) + '</p>' : '') +
        (a.needRecheck ? '<p class="archive__verdict">复评要求：需整改后复评</p>' : '') +

        '<p class="archive__disclaimer">本档案由「上播前·选品体检」本地生成，仅供内部决策参考，不构成法律意见；AI 不生成法条，判定须结合人工审核。' + (masked ? "（已脱敏显示）" : "") + '</p>' +
      '</div>';
  }

  // ---------- 演示模式 / 隐私说明（D10 / 评审 C9：三案例一键切换） ----------
  var DEMO_CASES = [
    {
      key: "green", name: "绿·可播（烟台苹果）",
      hint: "演示案例一：食用农产品·农户自销 → 应判「绿·可播」。主体已脱敏，编号均为演示虚构值。",
      daysAgo: 5, // 生产日期载入时按当天动态生成，避免初评时演示过期（评审 R4）
      data: {
        type: "NC", subject: "farmer", platform: "douyin",
        productName: "烟台苹果（红富士）· 演示", category: "食用农产品-鲜果",
        producer: "栖霞市某果品专业合作社（示例·已脱敏）", origin: "山东省烟台市栖霞市",
        spec: "5斤/箱（2.5kg）", shelfLife: "30天",
        qualifiedCert: "已提供", quarantineCert: "不适用（非畜禽）",
        claimText: "产地直发，当季采摘，脆甜多汁", oralClaim: "现摘现发，脆甜多汁"
      }
    },
    {
      key: "yellow", name: "黄·整改（莱阳梨膏）",
      hint: "演示案例二：预包装食品·企业经销 → 应判「黄·整改」，可生成整改单。",
      daysAgo: 40,
      data: {
        type: "YB", subject: "company", platform: "douyin",
        productName: "莱阳梨膏（案例示例）", category: "蜜饯果膏类-梨膏",
        producer: "莱阳某食品有限公司（示例·已脱敏）", origin: "山东省烟台市莱阳市",
        spec: "260g/瓶", shelfLife: "12个月",
        /* 演示号按“水果制品 117 + 烟台莱阳 370682”构造，与品类/产区自洽（评审 R5） */
        scNumber: "SC11737068200011", uscc: "91370682MA3D8C2K5N",
        labelComplete: "缺项", nutritionLabel: "已提供",
        claimText: "全网最低价，顶级食材，好吃不贵", oralClaim: "全网最低价，赶紧下单"
      }
    },
    {
      key: "red", name: "红·禁播（冒用检测报告）",
      hint: "演示案例三：报告产品名与申报品不符 → 应判「红·禁播」（R-COM-006）。",
      daysAgo: 40, validUntilDays: 300,
      data: {
        type: "YB", subject: "company", platform: "douyin",
        productName: "莱阳梨膏（案例示例）", category: "蜜饯果膏类-梨膏",
        producer: "莱阳某食品有限公司（示例·已脱敏）", origin: "山东省烟台市莱阳市",
        spec: "260g/瓶", shelfLife: "12个月",
        scNumber: "SC11737068200011", uscc: "91370682MA3D8C2K5N",
        labelComplete: "完整", nutritionLabel: "已提供",
        claimText: "产地直供，传统熬制", oralClaim: "",
        reportNo: "SDJC-2026-0912", reportProductName: "苹果汁饮料",
        reportSpec: "500ml/瓶", reportBatch: "20260801",
        reportCert: "两者都有", reportConclusion: "合格"
      }
    }
  ];

  /* 日期工具：按“今天 + offset 天”生成 YYYY-MM-DD（演示案例用，避免写死日期过期） */
  function dateOffset(offset) {
    var t = new Date();
    t.setHours(12, 0, 0, 0);
    t.setDate(t.getDate() + offset);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate());
  }

  function loadDemo(key) {
    var demo = null;
    for (var i = 0; i < DEMO_CASES.length; i++) {
      if (DEMO_CASES[i].key === key) { demo = DEMO_CASES[i]; break; }
    }
    if (!demo) { return; }
    // 复制一份再注入动态日期，避免把写死日期再存回 DEMO_CASES
    var D = {};
    Object.keys(demo.data).forEach(function (k) { D[k] = demo.data[k]; });
    if (demo.daysAgo !== undefined) { D.produceDate = dateOffset(-demo.daysAgo); }
    if (demo.validUntilDays !== undefined) { D.reportValidUntil = dateOffset(demo.validUntilDays); }

    state = { type: D.type, subject: D.subject, platform: D.platform };
    cards.forEach(function (c) {
      var f = c.getAttribute("data-field");
      c.classList.toggle("is-selected", state[f] === c.getAttribute("data-value"));
    });

    // 切换演示案例时清空上一单的核验/判定/审核状态：
    // 避免旧的“官方核验留痕”被写进新案例档案，也避免签字后审核台仍处于锁定态
    verify.hidden = true;
    judge.hidden = true;
    review.hidden = true;
    reviewState.hidden = true;
    rectify.hidden = true;
    archive.hidden = true;
    lastVerify = [];
    reviewItems = [];
    setReviewLocked(false);
    if (reviewVerdict) { reviewVerdict.value = ""; }
    if (reviewSigner) { reviewSigner.value = ""; }
    if (reviewDate) { reviewDate.value = ""; }
    if (reviewOwner) { reviewOwner.value = ""; }
    if (reviewNote) { reviewNote.value = ""; }
    if (reviewRecheck) { reviewRecheck.checked = false; }
    groups.subject.disabled = false;
    groups.platform.disabled = false;
    renderSummary();
    openEntry();
    entryForm.querySelectorAll("[data-key]").forEach(function (el) {
      var k = el.getAttribute("data-key");
      el.value = (D[k] === undefined || D[k] === null) ? "" : D[k];
    });
    saveDraft(false);
    setEntryHint(demo.hint + "（生产日期按打开当天自动生成；SC 号与统一社会信用代码为演示虚构值，不对应真实企业）", "ok");
  }

  function openPrivacy() {
    privacy.hidden = false;
    privacy.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closePrivacy() {
    privacy.hidden = true;
  }

  function clearAllData() {
    if (!window.confirm("确定清除本地全部数据（草稿、审核档案、误报记录、台账、OCR 密钥）？此操作不可撤销。")) { return; }
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(REVIEW_KEY);
      localStorage.removeItem(MISREPORT_KEY);
      localStorage.removeItem(LEDGER_KEY);
      localStorage.removeItem(OCR_KEY_STORE);
    } catch (e) { /* ignore */ }
    alert("已清除本地全部数据。");
  }

  // ---------- OCR 图片识别通道（D8） ----------
  function getOcrKey() {
    try { return (localStorage.getItem(OCR_KEY_STORE) || "").trim(); } catch (e) { return ""; }
  }

  function saveOcrKey() {
    var k = ocrKeyInput.value.trim();
    try {
      if (k) { localStorage.setItem(OCR_KEY_STORE, k); }
      else { localStorage.removeItem(OCR_KEY_STORE); }
    } catch (e) { /* ignore */ }
    setOcrStatus(k ? "密钥已保存到本机浏览器，可上传图片识别。" : "已清除密钥，将保持手录模式。", k ? "ok" : "warn");
  }

  function setOcrStatus(text, kind) {
    ocrStatusEl.textContent = text;
    ocrStatusEl.className = "ocr__status" + (kind ? " ocr__status--" + kind : "");
  }

  function handleOcrUpload(file) {
    if (!file) { return; }
    var key = getOcrKey();
    if (!key) {
      setOcrStatus("未配置识别密钥，已自动切换手录模式；可在下方「配置识别密钥」填入后重试，或直接手填下方字段。", "warn");
      ocrFileEl.value = "";
      return;
    }
    setOcrStatus("正在读取图片…", "loading");
    var reader = new FileReader();
    reader.onload = function () { callZhipuOcr(String(reader.result), key); };
    reader.onerror = function () { setOcrStatus("图片读取失败，请重试或改手录。", "error"); ocrFileEl.value = ""; };
    reader.readAsDataURL(file);
  }

  function callZhipuOcr(dataUrl, key) {
    setOcrStatus("正在调用 AI 识别（可能需要几秒）…", "loading");
    var prompt = [
      "你是食品包装信息抽取助手。识别这张食品包装/标签图片，提取下列字段并严格返回一个 JSON 对象（不要 markdown 代码块、不要多余文字），识别不出的字段省略：",
      "productName 产品名称；category 申报品类；producer 生产者/生产企业；origin 产地/生产地址；spec 净含量/规格；produceDate 生产日期（格式 YYYY-MM-DD）；shelfLife 保质期；scNumber 食品生产许可证编号（SC 开头）；uscc 统一社会信用代码（18 位）。",
      "只返回 JSON 对象本身。"
    ].join("\n");

    fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({
        model: "glm-4v-flash",
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } }
        ] }],
        temperature: 0.1
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (j) {
          throw new Error((j && j.error && j.error.message) ? j.error.message : ("HTTP " + res.status));
        });
      }
      return res.json();
    }).then(function (data) {
      var txt = (data && data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : "";
      var obj = parseOcrJson(txt);
      var n = fillOcrFields(obj);
      setOcrStatus(n > 0
        ? ("已识别并回填 " + n + " 个字段，请逐项人工核对后再继续判定。")
        : "模型未返回可回填字段，请检查图片清晰度或改手录。", n > 0 ? "ok" : "warn");
    }).catch(function (err) {
      setOcrStatus("识别失败：" + (err && err.message ? err.message : "网络或跨域错误") + "。已保持手录模式，可直接手填。", "error");
    }).finally(function () {
      ocrFileEl.value = "";
    });
  }

  function parseOcrJson(txt) {
    try {
      var s = String(txt == null ? "" : txt).trim();
      s = s.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
      return JSON.parse(s);
    } catch (e) { return null; }
  }

  function fillOcrFields(obj) {
    if (!obj || typeof obj !== "object") { return 0; }
    var n = 0;
    Object.keys(obj).forEach(function (k) {
      var el = entryForm.querySelector('[data-key="' + k + '"]');
      var v = obj[k];
      if (!el || v === undefined || v === null || String(v).trim() === "") { return; }
      el.value = v;
      n++;
    });
    if (n > 0) { saveDraft(false); }
    return n;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(__dirname, "..");
const repoRoot = resolve(packageDir, "..", "..");
const outputPath = resolve(packageDir, "models.py");

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const rootLocalEnv = readEnvFile(resolve(repoRoot, ".env.local"));
const packageEnv = readEnvFile(resolve(packageDir, ".env"));
const dbUrl =
  process.env.SUPABASE_DB_URL ||
  rootLocalEnv.SUPABASE_DB_URL ||
  packageEnv.SUPABASE_DB_URL ||
  "postgresql://postgres:postgres@localhost:62347/postgres";

const schemas = (process.env.DJANGO_MODEL_SCHEMAS || "public")
  .split(",")
  .map((schema) => schema.trim())
  .filter(Boolean);

const RESERVED_WORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

const FIELD_NAME_BLOCKLIST = new Set(["objects"]);

function py(value) {
  return JSON.stringify(value ?? "").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const TERM_LABELS = new Map(
  Object.entries({
    ability: "能力",
    account: "科目",
    accounts: "账款",
    accounting: "会计",
    active: "启用状态",
    address: "地址",
    adjustment: "调整",
    academy: "培训",
    api: "API",
    approval: "审批",
    archive: "归档",
    asset: "资产",
    assignee: "负责人",
    attempt: "尝试",
    attribute: "属性",
    audit: "审计",
    available: "可用",
    balance: "余额",
    balloon: "图纸标注",
    bank: "银行",
    barcode: "条码",
    batch: "批次",
    billing: "结算",
    bom: "物料清单",
    budget: "预算",
    calendar: "日历",
    capability: "能力",
    center: "中心",
    challenge: "练习挑战",
    class: "分类",
    code: "代码",
    color: "颜色",
    company: "公司",
    configuration: "配置",
    config: "配置",
    conflict: "冲突",
    consolidated: "合并",
    consumable: "耗材",
    contact: "联系人",
    contractor: "外协人员",
    conversion: "换算",
    cost: "成本",
    country: "国家",
    course: "课程",
    currency: "币种",
    custom: "自定义",
    customer: "客户",
    cycle: "周期",
    data: "数据",
    date: "日期",
    deadline: "截止期限",
    default: "默认",
    delivery: "交付",
    depreciation: "折旧",
    description: "描述",
    detail: "明细",
    document: "文档",
    due: "到期",
    email: "邮件",
    employee: "员工",
    end: "结束",
    entity: "实体",
    entry: "分录",
    event: "事件",
    exchange: "汇兑",
    factor: "系数",
    field: "字段",
    file: "文件",
    fixed: "固定",
    group: "组",
    has: "是否存在",
    handler: "处理器",
    hold: "冻结",
    id: "标识",
    image: "图片",
    inbound: "入库",
    income: "收益",
    inspection: "检验",
    integration: "集成",
    intercompany: "集团内往来",
    inventory: "库存",
    invoice: "发票",
    issue: "问题",
    item: "物料",
    job: "生产工单",
    journal: "会计凭证",
    kanban: "看板",
    key: "密钥",
    label: "标签",
    ledger: "台账",
    lesson: "课时",
    limit: "限制",
    line: "行",
    location: "库位",
    log: "日志",
    lot: "批号",
    make: "制造",
    material: "物料",
    method: "工艺",
    module: "模块",
    name: "名称",
    ncr: "不合格报告",
    notification: "通知",
    number: "编号",
    operation: "工序",
    opportunity: "商机",
    order: "订单",
    outbound: "出库",
    override: "覆盖",
    owner: "所有人",
    parameter: "参数",
    parent: "父级",
    partner: "伙伴",
    part: "零件",
    payable: "应付",
    payment: "付款",
    percentage: "百分比",
    period: "期间",
    permission: "权限",
    picking: "拣货",
    plan: "方案",
    price: "价格",
    priority: "优先级",
    process: "流程",
    product: "产品",
    production: "生产",
    property: "属性",
    purchase: "采购",
    quality: "质量",
    quantity: "数量",
    quote: "报价",
    rate: "费率",
    readable: "可读",
    reason: "原因",
    receipt: "收货",
    receivable: "应收",
    register: "登记册",
    replenishment: "补货",
    request: "申请",
    resource: "资源",
    revision: "版本",
    risk: "风险",
    role: "角色",
    route: "路线",
    rule: "规则",
    sales: "销售",
    schedule: "排程",
    scrap: "报废",
    search: "搜索",
    serial: "序列号",
    session: "会话",
    settings: "设置",
    shelf: "货架",
    shipment: "发货",
    shift: "班次",
    sort: "排序",
    source: "来源",
    sourcing: "寻源",
    start: "开始",
    status: "状态",
    step: "步骤",
    stock: "库存",
    supplier: "供应商",
    tag: "标签",
    tags: "标签",
    target: "目标",
    task: "任务",
    tax: "税",
    template: "模板",
    thumbnail: "缩略图",
    time: "时间",
    tracked: "追踪",
    training: "培训",
    transaction: "交易",
    transfer: "转移",
    type: "类型",
    unit: "单位",
    updated: "更新",
    usage: "用量",
    user: "用户",
    value: "值",
    variance: "差异",
    vendor: "供应商",
    version: "版本",
    warehouse: "仓库",
    webhook: "Webhook",
    week: "周",
    weeks: "周数",
    width: "宽度",
    work: "工作",
    xero: "Xero",
  })
);

const EXACT_LABELS = new Map(
  Object.entries({
    id: "记录标识",
    companyId: "公司租户标识",
    createdAt: "创建时间",
    createdBy: "创建人",
    updatedAt: "更新时间",
    updatedBy: "更新人",
    customFields: "自定义字段",
    tags: "标签",
    active: "启用状态",
    name: "名称",
    description: "描述",
    status: "状态",
    type: "类型",
    sortOrder: "排序顺序",
    externalId: "外部系统标识",
    readableId: "业务可读编号",
    itemId: "物料标识",
    jobId: "生产工单标识",
    operationId: "工序标识",
    supplierId: "供应商标识",
    customerId: "客户标识",
    employeeId: "员工标识",
    userId: "用户标识",
    accountId: "会计科目标识",
    paymentTerm: "付款条件",
    shippingMethod: "配送方式",
    shippingTerm: "运输条款",
    unitOfMeasure: "计量单位",
    carrier: "承运商",
    calculationMethod: "计算方式",
    quantity: "数量",
    unitOfMeasureCode: "计量单位代码",
    dueDate: "到期日期",
    startDate: "开始日期",
    endDate: "结束日期",
    curve: "能力曲线",
    shadowWeeks: "影子周数",
    isGroup: "是否分组",
    isSystem: "是否系统内置",
    itemScrapPercentage: "物料报废百分比",
    conflictReason: "冲突原因",
    hasConflict: "是否存在冲突",
    targetQuantity: "目标数量",
    intercompanyPartnerId: "集团内往来对方公司标识",
  })
);

const PG_COMMENT_TRANSLATIONS = new Map(
  Object.entries({
    "Scrap percentage from itemReplenishment at time of job creation":
      "生产工单创建时从物料补货设置带入的报废百分比。",
    "Human-readable explanation of the scheduling conflict":
      "面向用户展示的排程冲突说明。",
    "Indicates if this operation has a scheduling conflict (e.g., start date in the past)":
      "标识该工序是否存在排程冲突，例如开始日期早于当前日期。",
    "The target quantity to produce before accounting for scrap (parent.estimatedQuantity * quantityPerParent)":
      "未计入报废前需要生产的目标数量，计算来源为父级预计数量乘以每父项用量。",
    "The counterparty company within the same group for intercompany transactions":
      "集团内往来交易中的对方公司。",
  })
);

const TABLE_LABEL_OVERRIDES = new Map(
  Object.entries({
    item: "物料主档",
    accountDefault: "默认会计科目",
    part: "零件资料",
    material: "材料资料",
    tool: "工具资料",
    consumable: "耗材资料",
    makeMethod: "制造工艺",
    methodMaterial: "工艺物料",
    methodOperation: "工艺工序",
    methodOperationParameter: "工序参数",
    methodOperationStep: "工序步骤",
    methodOperationTool: "工序工具",
    job: "生产工单",
    jobMakeMethod: "生产工单工艺",
    jobMaterial: "生产工单物料",
    jobOperation: "生产工单工序",
    quoteMakeMethod: "报价工艺",
    quoteMaterial: "报价物料",
    quoteOperation: "报价工序",
    purchasingRfq: "采购询价单",
    purchasingRfqLine: "采购询价单行",
    purchasingRfqSupplier: "采购询价供应商",
    purchasingRfqToPurchaseOrder: "采购询价转采购订单",
    salesRfq: "销售询价",
    salesRfqLine: "销售询价行",
    salesOrderShipment: "销售订单发货",
    customerShipping: "客户收货设置",
    paymentTerm: "付款条件",
    shippingMethod: "配送方式",
    shippingTerm: "运输条款",
    unitOfMeasure: "计量单位",
    itemReplenishment: "物料补货与制造参数",
    itemUnitSalePrice: "物料销售单位价格",
    supplierPart: "供应商物料",
    supplierShipping: "供应商发货设置",
    supplierProcess: "供应商工艺能力",
    workCenter: "工作中心",
    process: "工艺流程",
    procedure: "作业程序",
  })
);

const TABLE_DOMAIN_OVERRIDES = new Map(
  Object.entries({
    paymentTerm: "财务会计",
    shippingMethod: "库存与仓储",
    shippingTerm: "财务会计",
    unitOfMeasure: "库存与仓储",
  })
);

const FIELD_LABEL_OVERRIDES = new Map(
  Object.entries({
    "*.approvedBy": "审批人",
    "*.closedAt": "关闭时间",
    "*.closedBy": "关闭人",
    "*.completedAt": "完成时间",
    "*.fromDate": "生效开始日期",
    "*.toDate": "生效结束日期",
    "*.postingDate": "过账日期",
    "*.readableId": "业务编号",
    "*.readableIdWithRevision": "含版本业务编号",
    "*.modelUploadId": "模型文件标识",
    "*.thumbnailPath": "缩略图路径",
    "*.notes": "备注",
    "*.order": "排序顺序",
    "*.sortOrder": "排序顺序",
    "*.replenishmentSystem": "补货方式",
    "*.defaultMethodType": "默认取得方式",
    "*.itemTrackingType": "库存跟踪方式",
    "*.trackingMethod": "跟踪方法",
    "*.sourcingType": "供应来源方式",
    "*.unitOfMeasureCode": "计量单位代码",
    "*.requiresInspection": "是否需要检验",
    "*.makeMethodId": "制造工艺标识",
    "*.methodOperationId": "关联工序标识",
    "*.operationId": "工序标识",
    "*.operationOrder": "工序衔接方式",
    "*.operationType": "工序类型",
    "*.processId": "工艺流程标识",
    "*.workCenterId": "工作中心标识",
    "*.procedureId": "作业程序标识",
    "*.setupTime": "准备时间",
    "*.setupUnit": "准备时间单位",
    "*.laborTime": "人工时间",
    "*.laborUnit": "人工时间单位",
    "*.machineTime": "设备时间",
    "*.machineUnit": "设备时间单位",
    "*.laborRate": "人工费率",
    "*.machineRate": "设备费率",
    "*.operationSupplierProcessId": "外协供应商工艺标识",
    "*.operationMinimumCost": "外协最低费用",
    "*.operationLeadTime": "外协提前期",
    "*.operationUnitCost": "外协单价",
    "*.workInstruction": "作业指导书",
    "*.materialMakeMethodId": "组件制造工艺标识",
    "*.methodType": "取得方式",
    "*.scrapQuantity": "报废补偿数量",
    "*.productionQuantity": "生产需求数量",
    "*.kit": "是否套件发料",
    "*.storageUnitIds": "库存单元分配",
    "*.itemPostingGroupId": "物料过账组标识",
    "*.minimumOrderQuantity": "最小订购数量",
    "*.maximumOrderQuantity": "最大订购数量",
    "*.orderMultiple": "订购倍量",
    "*.trackingNumber": "物流跟踪号",
    "*.trackingUrl": "物流跟踪链接",
    "*.shippingMethodId": "配送方式标识",
    "*.shippingTermId": "运输条款标识",
    "*.paymentTermId": "付款条件标识",
    "*.daysDue": "到期天数",
    "*.daysDiscount": "折扣天数",
    "*.discountPercentage": "折扣百分比",
    "*.shippingCustomerId": "收货客户标识",
    "*.shippingCustomerLocationId": "收货客户地址标识",
    "*.shippingCustomerContactId": "收货客户联系人标识",
    "*.shippingSupplierId": "发货供应商标识",
    "*.shippingSupplierLocationId": "发货供应商地址标识",
    "*.shippingSupplierContactId": "发货供应商联系人标识",
    "*.carrier": "承运商",
    "*.carrierAccountId": "承运商费用科目标识",
    "*.calculationMethod": "计算方式",
    "*.totalAmount": "总金额",
    "*.postedBy": "过账人",
    "*.invoiced": "是否已开票",
    "*.externalDocumentId": "外部文档标识",
    "*.supplierInteractionId": "供应商往来标识",
    "*.addressLine1": "地址行1",
    "*.addressLine2": "地址行2",
    "*.city": "城市",
    "*.stateProvince": "州/省",
    "*.postalCode": "邮政编码",
    "*.phone": "电话",
    "*.fax": "传真",
    "*.keyHash": "密钥哈希",
    "*.keyPreview": "密钥预览",
    "*.scopes": "权限范围",
    "*.rateLimitWindow": "限流窗口",
    "*.expiresAt": "过期时间",
    "*.lastUsedAt": "最后使用时间",
    "*.windowStart": "窗口开始时间",
    "*.requestCount": "请求次数",
    "*.amount": "金额",
    "*.requestedBy": "申请人",
    "*.requestedById": "申请人标识",
    "*.requestedAt": "申请时间",
    "*.decisionBy": "审批决定人",
    "*.decisionAt": "审批决定时间",
    "*.decisionNotes": "审批意见",
    "*.enabled": "是否启用",
    "*.approverGroupIds": "审批组标识列表",
    "*.defaultApproverId": "默认审批人标识",
    "*.lowerBoundAmount": "金额下限",
    "*.escalationDays": "升级天数",
    "*.isBoolean": "是否布尔值",
    "*.isDate": "是否日期",
    "*.isList": "是否列表",
    "*.isNumeric": "是否数值",
    "*.isText": "是否文本",
    "*.isUser": "是否用户",
    "*.isCustomer": "是否客户",
    "*.isSupplier": "是否供应商",
    "*.isFile": "是否文件",
    "*.archivePath": "归档路径",
    "*.rowCount": "行数",
    "*.sizeBytes": "大小字节数",
    "*.inspectionFeatureId": "检验特征标识",
    "*.pageNumber": "页码",
    "*.regionX": "区域X坐标",
    "*.regionY": "区域Y坐标",
    "*.regionWidth": "区域宽度",
    "*.regionHeight": "区域高度",
    "*.xCoordinate": "X坐标",
    "*.yCoordinate": "Y坐标",
    "*.listOptions": "列表选项",
    "*.salesDiscountAccount": "销售折扣科目",
    "*.costOfGoodsSoldAccount": "销售成本科目",
    "*.laborAndMachineVarianceAccount": "人工与设备差异科目",
    "*.indirectCostAccount": "间接成本科目",
    "*.maintenanceAccount": "维护科目",
    "*.assetDepreciationExpenseAccount": "资产折旧费用科目",
    "*.assetGainsAndLossesAccount": "资产处置损益科目",
    "*.serviceChargeAccount": "服务费科目",
    "*.interestAccount": "利息科目",
    "*.supplierPaymentDiscountAccount": "供应商付款折扣科目",
    "*.customerPaymentDiscountAccount": "客户付款折扣科目",
    "*.roundingAccount": "舍入差异科目",
    "*.assetAquisitionCostAccount": "资产取得成本科目",
    "*.assetAquisitionCostOnDisposalAccount": "资产处置取得成本科目",
    "*.accumulatedDepreciationAccount": "累计折旧科目",
    "*.accumulatedDepreciationOnDisposalAccount": "处置时累计折旧科目",
    "*.workInProgressAccount": "在制品科目",
    "*.receivablesAccount": "应收账款科目",
    "*.inventoryShippedNotInvoicedAccount": "已发货未开票库存科目",
    "*.bankCashAccount": "银行现金科目",
    "*.bankLocalCurrencyAccount": "银行本币科目",
    "*.bankForeignCurrencyAccount": "银行外币科目",
    "*.prepaymentAccount": "预付款科目",
    "*.payablesAccount": "应付账款科目",
    "*.reverseChargeSalesTaxPayableAccount": "反向征收销售税应付科目",
    "*.retainedEarningsAccount": "留存收益科目",
    "*.goodsReceivedNotInvoicedAccount": "已收货未开票科目",
    "*.overheadVarianceAccount": "制造费用差异科目",
    "*.lotSizeVarianceAccount": "批量差异科目",
    "*.subcontractingVarianceAccount": "外协差异科目",
    "*.currencyTranslationAccount": "币种折算科目",
    "*.laborAbsorptionAccount": "人工吸收科目",
    "*.deferredTaxLiabilityAccountId": "递延所得税负债科目标识",
    "*.deferredTaxExpenseAccountId": "递延所得税费用科目标识",
    "*.unitOfMeasure": "计量单位",
    "*.purchasingUnitOfMeasureCode": "采购计量单位代码",
    "*.salesUnitOfMeasureCode": "销售计量单位代码",
    "*.supplierUnitOfMeasureCode": "供应商计量单位代码",
    "*.purchasingRfqId": "采购询价单标识",
    "*.salesRfqId": "销售询价标识",
    "*.quoteId": "报价单标识",
    "*.purchaseUnitOfMeasureCode": "采购计量单位代码",
    "*.inventoryUnitOfMeasureCode": "库存计量单位代码",
    "*.conversionFactor": "换算系数",
    "itemReplenishment.manufacturingBlocked": "制造冻结",
    "itemReplenishment.requiresConfiguration": "需要制造配置",
    "itemReplenishment.lotSize": "制造批量",
    "itemReplenishment.scrapPercentage": "制造报废比例",
    "itemReplenishment.leadTime": "制造提前期（天）",
    "*.internalNotes": "内部备注",
    "*.externalNotes": "外部备注",
    "*.receiptRequestedDate": "要求收货日期",
    "*.receiptPromisedDate": "承诺收货日期",
    "*.sentDate": "发送日期",
    "*.paymentComplete": "是否付款完成",
    "*.dropShipment": "是否直运",
    "*.shippingCost": "运费",
    "*.supplierShippingCost": "供应商运费",
    "*.addOnCost": "附加费用",
    "*.convertedAddOnCost": "本币附加费用",
    "*.convertedShippingCost": "本币运费",
    "*.convertedUnitPrice": "本币单位价格",
    "*.nonTaxableAddOnCost": "非应税附加费用",
    "*.convertedNonTaxableAddOnCost": "本币非应税附加费用",
    "*.priceTrace": "定价过程",
    "*.incoterm": "国际贸易术语",
    "*.incotermLocation": "贸易术语地点",
    "methodOperation.description": "工序说明",
    "jobOperation.description": "工序说明",
    "quoteOperation.description": "工序说明",
    "methodMaterial.quantity": "用量",
    "jobMaterial.quantity": "需求数量",
    "quoteMaterial.quantity": "报价用量",
  })
);

const FIELD_HELP_OVERRIDES = new Map(
  Object.entries({
    "item.replenishmentSystem": "定义物料主要通过采购、生产或两者结合来补货，是计划、采购和生产逻辑的基础",
    "item.defaultMethodType": "定义物料默认按库存领用、按单采购或按单制造，用于新增 BOM、报价和生产需求时带出默认方式",
    "item.itemTrackingType": "定义物料是否按库存、非库存、序列号或批次进行跟踪，影响库存台账和发料/收货控制",
    "item.sourcingType": "定义物料在需求场景中的默认供应来源，如指定供应、直运或从库存发运",
    "item.readableIdWithRevision": "业务展示用编号，自动把物料编号和版本组合成页面、搜索和单据中显示的编号",
    "item.modelUploadId": "关联物料的三维模型或图纸上传记录，用于预览、缩略图和工程文件展示",
    "itemReplenishment.manufacturingBlocked": "标识该物料是否禁止制造补货，生产计划和工单创建会据此阻止制造需求",
    "itemReplenishment.requiresConfiguration": "对应零件详情 Manufacturing 面板的 Configured 开关，标识该物料制造前是否需要先完成配置参数和规则",
    "itemReplenishment.lotSize": "对应零件详情 Manufacturing 面板的 Batch Size，作为制造件默认生产批量，生产计划和工单创建会用它拆分或带出数量",
    "itemReplenishment.scrapPercentage": "对应零件详情 Manufacturing 面板的 Scrap Percent，作为制造预计报废比例，工单会按生产数量乘以该比例计算报废数量",
    "itemReplenishment.leadTime": "对应零件详情 Manufacturing 面板的 Lead Time (Days)，表示制造提前期天数，用于生产计划和交期倒推",
    "makeMethod.itemId": "该制造工艺所属的物料主档记录，通常是零件、工具或其他可制造物料",
    "makeMethod.version": "制造工艺版本号，用于同一物料的工艺版本管理",
    "makeMethod.status": "制造工艺状态，草稿可编辑，启用后用于报价、生产和版本复制",
    "methodMaterial.makeMethodId": "该物料行所属的制造工艺",
    "methodMaterial.methodType": "该组件在工艺中的取得方式，如按单采购、从库存领用或按单制造",
    "methodMaterial.materialMakeMethodId": "当组件需要制造时，指向该组件自身使用的制造工艺",
    "methodMaterial.methodOperationId": "把物料消耗挂到指定工序，用于按工序领料、齐套和工序级物料展示",
    "methodMaterial.quantity": "生产父项每件所需的组件用量",
    "methodMaterial.scrapQuantity": "为预计报废额外准备的组件数量",
    "methodMaterial.productionQuantity": "包含报废补偿后的实际生产需求数量",
    "methodMaterial.kit": "标识该组件是否按套件方式随工序或工单一起发料",
    "methodMaterial.storageUnitIds": "记录该工艺物料在发料或齐套场景中分配的库存单元信息",
    "methodOperation.makeMethodId": "该工序所属的制造工艺",
    "methodOperation.order": "工序在 Bill of Process 中的显示和执行排序",
    "methodOperation.operationOrder": "定义该工序与前一道工序的衔接方式，是顺序执行还是可与前序并行",
    "methodOperation.operationType": "区分内部加工和外协加工，决定页面显示工作中心还是供应商工艺与外协成本",
    "methodOperation.processId": "工序所采用的工艺流程，带出默认说明、工序类型和可选工作中心/供应商工艺",
    "methodOperation.workCenterId": "内部工序执行的工作中心，用于产能、成本、排程和工单派工",
    "methodOperation.setupTime": "工序开始前的准备时间",
    "methodOperation.setupUnit": "准备时间的计量方式，如总分钟或总小时",
    "methodOperation.laborTime": "完成该工序所需的人工时间",
    "methodOperation.laborUnit": "人工时间的计量方式，如每件分钟或每件小时",
    "methodOperation.machineTime": "完成该工序所需的设备时间",
    "methodOperation.machineUnit": "设备时间的计量方式，如每件分钟或每件小时",
    "methodOperation.operationSupplierProcessId": "外协工序选择的供应商工艺能力",
    "methodOperation.operationMinimumCost": "外协工序的最低费用，用于报价和成本估算",
    "methodOperation.operationLeadTime": "外协工序预计提前期，用于计划和交期估算",
    "methodOperation.operationUnitCost": "外协工序的单位加工费用",
    "methodOperation.workInstruction": "工序作业指导书内容，前端以富文本/结构化 JSON 编辑和展示",
    "methodOperation.procedureId": "关联标准作业程序，生产执行时可生成工序步骤、参数和检验要求",
    "methodOperation.tags": "工序标签，用于分类、筛选和页面标记",
    "jobOperation.jobMakeMethodId": "该工序所属的生产工单工艺实例",
    "jobOperation.order": "工单工序的执行和显示顺序",
    "jobOperation.workInstruction": "生产工单执行时使用的作业指导书快照",
    "quoteOperation.quoteMakeMethodId": "该工序所属的报价工艺实例",
    "quoteOperation.order": "报价工序的显示和计算顺序",
    "purchasingRfqLine.purchaseUnitOfMeasureCode": "采购询价行使用的采购计量单位代码",
    "purchasingRfqLine.inventoryUnitOfMeasureCode": "采购询价行对应的库存计量单位代码",
    "purchasingRfqLine.conversionFactor": "采购单位与库存单位之间的换算系数",
    "purchasingRfqLine.internalNotes": "仅内部人员可见的采购询价行备注",
    "purchasingRfqLine.externalNotes": "可对供应商或外部文档展示的采购询价行备注",
    "paymentTerm.daysDue": "从付款条件计算基准日起，到应付款或应收款到期的天数",
    "paymentTerm.daysDiscount": "从付款条件计算基准日起，可享受现金折扣的天数",
    "paymentTerm.discountPercentage": "现金折扣比例，0 表示没有折扣",
    "paymentTerm.calculationMethod": "付款到期日和折扣期的计算基准，如净额、月末或指定日期",
    "salesOrderShipment.dropShipment": "标识该销售订单发货是否由供应商直运给客户",
    "salesOrderShipment.shippingCost": "该销售订单发货的预计或实际运费",
  })
);

function identifierParts(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^0-9A-Za-z]+|_/)
    .filter(Boolean);
}

function labelForIdentifier(value) {
  if (EXACT_LABELS.has(value)) return EXACT_LABELS.get(value);
  const parts = identifierParts(value);
  if (parts.length === 0) return String(value);
  return parts
    .map((part) => TERM_LABELS.get(part.toLowerCase()) || part)
    .join("");
}

function tableColumnKey(column) {
  return `${column.table_name}.${column.column_name}`;
}

function labelForColumn(column) {
  return (
    FIELD_LABEL_OVERRIDES.get(tableColumnKey(column)) ||
    FIELD_LABEL_OVERRIDES.get(`*.${column.column_name}`) ||
    labelForIdentifier(column.column_name)
  );
}

function labelForTableName(tableName) {
  return TABLE_LABEL_OVERRIDES.get(tableName) || labelForIdentifier(tableName);
}

function tableDomain(tableName) {
  if (TABLE_DOMAIN_OVERRIDES.has(tableName)) return TABLE_DOMAIN_OVERRIDES.get(tableName);
  const tokens = new Set(identifierParts(tableName).map((part) => part.toLowerCase()));
  const hasAny = (...values) => values.some((value) => tokens.has(value));
  if (hasAny("course", "lesson", "challenge", "academy", "training")) return "Academy 培训";
  if (hasAny("job", "operation", "method", "bom", "work", "schedule", "shift")) return "MES 生产";
  if (hasAny("inventory", "warehouse", "shelf", "stock", "serial", "batch", "kanban", "picking", "tracked")) {
    return "库存与仓储";
  }
  if (hasAny("purchase", "supplier", "receipt", "payable")) return "采购与应付";
  if (hasAny("sales", "customer", "quote", "opportunity", "shipment", "receivable")) return "销售与应收";
  if (hasAny("account", "accounting", "journal", "ledger", "cost", "currency", "tax", "fixed", "asset")) {
    return "财务会计";
  }
  if (hasAny("quality", "inspection", "ncr", "issue", "risk", "balloon")) return "质量管理";
  if (hasAny("user", "employee", "role", "permission", "api", "session")) return "身份与权限";
  if (hasAny("integration", "xero", "webhook", "event", "notification", "email")) return "系统集成";
  if (hasAny("company", "billing", "plan", "usage")) return "租户与订阅";
  if (hasAny("configuration", "config", "settings", "parameter", "template")) return "系统配置";
  return "制造业务";
}

function tableLabel(table) {
  return labelForTableName(table.table_name);
}

function tableDoc(table) {
  const comment = PG_COMMENT_TRANSLATIONS.get(table.table_comment) || table.table_comment;
  if (comment) return `Carbon ${tableDomain(table.table_name)}模块的${tableLabel(table)}表（${table.table_schema}.${table.table_name}）：${comment}`;
  return `Carbon ${tableDomain(table.table_name)}模块的${tableLabel(table)}表（${table.table_schema}.${table.table_name}），用于维护${tableLabel(table)}相关业务数据。`;
}

function columnDoc(column, fk) {
  const comment = PG_COMMENT_TRANSLATIONS.get(column.column_comment) || column.column_comment;
  if (comment) return comment;

  const label = labelForColumn(column);
  const table = tableLabel(column);
  const typeInfo = `PostgreSQL 类型：${column.formatted_type}`;
  const helpOverride =
    FIELD_HELP_OVERRIDES.get(tableColumnKey(column)) ||
    FIELD_HELP_OVERRIDES.get(`*.${column.column_name}`);
  if (helpOverride) return `${helpOverride}；${typeInfo}。`;
  if (fk) {
    const target = labelForTableName(fk.foreign_table);
    return `关联${target}记录，作为${table}的${label}；${typeInfo}。`;
  }
  if (column.column_name === "companyId") {
    return `标识该记录所属公司租户，用于 Carbon 多租户隔离；${typeInfo}。`;
  }
  if (column.column_name === "createdBy") return `记录创建该业务记录的用户；${typeInfo}。`;
  if (column.column_name === "createdAt") return `记录该业务记录的创建时间；${typeInfo}。`;
  if (column.column_name === "updatedBy") return `记录最后更新该业务记录的用户；${typeInfo}。`;
  if (column.column_name === "updatedAt") return `记录该业务记录的最后更新时间；${typeInfo}。`;
  return `存储${table}的${label}；${typeInfo}。`;
}

function columnLineComment(column) {
  const nullableInfo = column.is_nullable === "YES" ? "可为空" : "非空";
  const defaultInfo = column.column_default
    ? `；默认值：${squashWhitespace(column.column_default)}`
    : "";
  return `第 ${column.ordinal_position} 列：${labelForColumn(column)} ${column.column_name}（${column.formatted_type}，${nullableInfo}${defaultInfo}）`;
}

function toIdentifier(value, fallback) {
  let ident = String(value)
    .replace(/[^0-9A-Za-z_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!ident) ident = fallback;
  if (/^[0-9]/.test(ident)) ident = `${fallback}_${ident}`;
  if (RESERVED_WORDS.has(ident)) ident = `${ident}_field`;
  return ident;
}

function toClassName(schema, table, used) {
  const raw =
    schemas.length > 1 && schema !== "public" ? `${schema}_${table}` : table;
  let className = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^0-9A-Za-z]+|_/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  if (!className) className = "Model";
  if (/^[0-9]/.test(className)) className = `Model${className}`;
  if (RESERVED_WORDS.has(className)) className = `${className}Model`;

  const base = className;
  let counter = 2;
  while (used.has(className)) {
    className = `${base}${counter}`;
    counter += 1;
  }
  used.add(className);
  return className;
}

function qname(schema, name) {
  return `${schema}.${name}`;
}

function dbTableName(schema, table) {
  return schema === "public" ? table : `${schema}"."${table}`;
}

function constraintAction(code) {
  return (
    {
      a: "NO ACTION",
      r: "RESTRICT",
      c: "CASCADE",
      n: "SET NULL",
      d: "SET DEFAULT",
    }[code] || code
  );
}

function defaultLooksAuto(defaultValue) {
  if (!defaultValue) return false;
  return /nextval\(|gen_random_uuid\(\)|uuid_generate_v4\(\)|extensions\.uuid_generate_v4\(\)/i.test(
    defaultValue
  );
}

function isNowDefault(defaultValue) {
  return /now\(\)|CURRENT_TIMESTAMP/i.test(defaultValue || "");
}

function buildFieldName(columnName, used) {
  let fieldName = toIdentifier(columnName, "field");
  if (FIELD_NAME_BLOCKLIST.has(fieldName)) fieldName = `${fieldName}_field`;
  const base = fieldName;
  let counter = 2;
  while (used.has(fieldName)) {
    fieldName = `${base}_${counter}`;
    counter += 1;
  }
  used.add(fieldName);
  return fieldName;
}

function enumChoicesName(typeName, used) {
  let name = `${toIdentifier(typeName, "enum").toUpperCase()}_CHOICES`;
  name = name.replace(/[^0-9A-Z_]/g, "_");
  if (/^[0-9]/.test(name)) name = `ENUM_${name}`;
  const base = name;
  let counter = 2;
  while (used.has(name)) {
    name = `${base}_${counter}`;
    counter += 1;
  }
  used.add(name);
  return name;
}

function mapScalarField(column, enumChoiceNames, options = {}) {
  const formatted = (column.formatted_type || "").toLowerCase();
  const dataType = (column.data_type || "").toLowerCase();
  const udtName = column.udt_name;
  const enumKey = qname(column.udt_schema, udtName);
  const elementEnumKey = qname(column.element_udt_schema, column.element_udt_name);
  const kwargs = [];
  let field = "models.TextField";

  if (dataType === "user-defined" && enumChoiceNames.has(enumKey)) {
    field = "models.CharField";
    kwargs.push(`max_length=${column.enum_max_length || 255}`);
    kwargs.push(`choices=${enumChoiceNames.get(enumKey)}`);
  } else if (column.element_typtype === "e" && enumChoiceNames.has(elementEnumKey)) {
    field = "models.CharField";
    kwargs.push(`max_length=${column.element_enum_max_length || 255}`);
    kwargs.push(`choices=${enumChoiceNames.get(elementEnumKey)}`);
  } else if (dataType === "uuid" || udtName === "uuid") {
    field = "models.UUIDField";
  } else if (["text"].includes(dataType) || udtName === "text") {
    field = "models.TextField";
  } else if (
    ["character varying", "character"].includes(dataType) ||
    ["varchar", "bpchar"].includes(udtName)
  ) {
    field = "models.CharField";
    kwargs.push(`max_length=${column.character_maximum_length || 255}`);
  } else if (["smallint"].includes(dataType) || udtName === "int2") {
    field = "models.SmallIntegerField";
  } else if (["integer"].includes(dataType) || udtName === "int4") {
    field = "models.IntegerField";
  } else if (["bigint"].includes(dataType) || udtName === "int8") {
    field = "models.BigIntegerField";
  } else if (["numeric", "decimal"].includes(dataType) || udtName === "numeric") {
    field = "models.DecimalField";
    kwargs.push(`max_digits=${column.numeric_precision || 32}`);
    kwargs.push(`decimal_places=${column.numeric_scale ?? 16}`);
  } else if (
    ["real", "double precision"].includes(dataType) ||
    ["float4", "float8"].includes(udtName)
  ) {
    field = "models.FloatField";
  } else if (dataType === "boolean" || udtName === "bool") {
    field = "models.BooleanField";
  } else if (dataType === "date" || udtName === "date") {
    field = "models.DateField";
  } else if (
    dataType.startsWith("timestamp") ||
    ["timestamp", "timestamptz"].includes(udtName)
  ) {
    field = "models.DateTimeField";
  } else if (dataType.startsWith("time") || ["time", "timetz"].includes(udtName)) {
    field = "models.TimeField";
  } else if (["json", "jsonb"].includes(dataType) || ["json", "jsonb"].includes(udtName)) {
    field = "models.JSONField";
  } else if (dataType === "bytea" || udtName === "bytea") {
    field = "models.BinaryField";
  } else if (udtName === "inet") {
    field = "models.GenericIPAddressField";
  } else if (udtName === "interval") {
    field = "models.DurationField";
  } else if (formatted === "tsvector") {
    field = "models.TextField";
  }

  if (options.omitLength) {
    const withoutLength = kwargs.filter(
      (kwarg) => !kwarg.startsWith("max_length=") && !kwarg.startsWith("choices=")
    );
    return { field, kwargs: withoutLength };
  }

  return { field, kwargs };
}

function mapColumnField(column, context) {
  const enumChoiceNames = context.enumChoiceNames;
  if ((column.data_type || "").toLowerCase() === "array") {
    const baseColumn = {
      ...column,
      data_type: column.element_data_type,
      udt_name: column.element_udt_name,
      udt_schema: column.element_udt_schema,
      formatted_type: column.element_formatted_type,
    };
    const scalar = mapScalarField(baseColumn, enumChoiceNames, { omitLength: true });
    return {
      field: "ArrayField",
      kwargs: [`base_field=${scalar.field}(${scalar.kwargs.join(", ")})`],
    };
  }
  return mapScalarField(column, enumChoiceNames);
}

function relationTargetName(fk, tableClassNames) {
  return tableClassNames.get(qname(fk.foreign_schema, fk.foreign_table)) || "self";
}

function relationField(column, fk, context) {
  const targetName = relationTargetName(fk, context.tableClassNames);
  return {
    field: "models.ForeignKey",
    kwargs: [py(targetName), "models.DO_NOTHING"],
  };
}

function fieldArgs(column, fieldName, fieldSpec, fk, primaryKeyColumns, uniqueSingleColumns) {
  const args = [...fieldSpec.kwargs];
  const nullable = column.is_nullable === "YES";
  const isPk = primaryKeyColumns.includes(column.column_name);
  const isUnique = uniqueSingleColumns.has(column.column_name) && !isPk;

  if (fieldName !== column.column_name || fk) {
    args.push(`db_column=${py(column.column_name)}`);
  }
  args.push(`verbose_name=${py(labelForColumn(column))}`);
  if (isPk) args.push("primary_key=True");
  if (isUnique) args.push("unique=True");
  if (nullable && !isPk) {
    args.push("blank=True");
    args.push("null=True");
  }
  if (defaultLooksAuto(column.column_default) || column.is_identity === "YES") {
    // Database-managed defaults are intentionally documented instead of copied
    // into Django, because these unmanaged models should not own DDL.
  } else if (isNowDefault(column.column_default)) {
    args.push("auto_now_add=True");
  }
  args.push(`help_text=${py(columnDoc(column, fk))}`);
  return args;
}

function squashWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .trim();
}

function uniqueTogether(uniqueConstraints, primaryKeyColumns) {
  const tuples = [];
  for (const constraint of uniqueConstraints) {
    if (constraint.columns.length <= 1) continue;
    if (
      constraint.contype === "p" &&
      constraint.columns.join("\u0000") === primaryKeyColumns.join("\u0000")
    ) {
      tuples.push(constraint.columns);
      continue;
    }
    if (constraint.contype === "u") tuples.push(constraint.columns);
  }
  return tuples;
}

function renderTuple(values) {
  if (values.length === 1) return `(${py(values[0])},)`;
  return `(${values.map(py).join(", ")})`;
}

function normalizePgArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value !== "string") return [String(value)];
  if (!value.startsWith("{") || !value.endsWith("}")) return [value];
  const inner = value.slice(1, -1);
  if (!inner) return [];
  const values = [];
  let current = "";
  let quoted = false;
  let escaped = false;
  for (const char of inner) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

async function main() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const { rows: tables } = await client.query(
    `
          SELECT
            n.nspname AS table_schema,
            c.relname AS table_name,
            c.relkind,
            obj_description(c.oid, 'pg_class') AS table_comment
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r', 'p')
            AND n.nspname = ANY($1)
          ORDER BY n.nspname, c.relname
        `,
    [schemas]
  );
  const { rows: columns } = await client.query(
    `
          SELECT
            n.nspname AS table_schema,
            c.relname AS table_name,
            a.attname AS column_name,
            a.attnum AS ordinal_position,
            pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
            CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
            info.data_type,
            info.udt_schema,
            info.udt_name,
            info.character_maximum_length,
            info.numeric_precision,
            info.numeric_scale,
            info.datetime_precision,
            info.is_identity,
            info.identity_generation,
            info.is_generated,
            info.generation_expression,
            t.typtype,
            format_type(a.atttypid, a.atttypmod) AS formatted_type,
            et.typname AS element_udt_name,
            etns.nspname AS element_udt_schema,
            et.typtype AS element_typtype,
            format_type(t.typelem, NULL) AS element_formatted_type,
            CASE
              WHEN et.typcategory = 'S' THEN 'text'
              WHEN et.typname IN ('int2', 'int4', 'int8') THEN 'integer'
              WHEN et.typname IN ('numeric') THEN 'numeric'
              WHEN et.typname IN ('float4', 'float8') THEN 'double precision'
              WHEN et.typname = 'bool' THEN 'boolean'
              WHEN et.typname IN ('timestamp', 'timestamptz') THEN 'timestamp without time zone'
              WHEN et.typname = 'date' THEN 'date'
              WHEN et.typname IN ('json', 'jsonb') THEN 'jsonb'
              WHEN et.typname = 'uuid' THEN 'uuid'
              ELSE et.typname
            END AS element_data_type,
            col_description(c.oid, a.attnum) AS column_comment
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_type t ON t.oid = a.atttypid
          LEFT JOIN pg_type et ON et.oid = t.typelem
          LEFT JOIN pg_namespace etns ON etns.oid = et.typnamespace
          LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
          LEFT JOIN information_schema.columns info
            ON info.table_schema = n.nspname
           AND info.table_name = c.relname
           AND info.column_name = a.attname
          WHERE a.attnum > 0
            AND NOT a.attisdropped
            AND c.relkind IN ('r', 'p')
            AND n.nspname = ANY($1)
          ORDER BY n.nspname, c.relname, a.attnum
        `,
    [schemas]
  );
  const { rows: constraints } = await client.query(
    `
          SELECT
            n.nspname AS table_schema,
            c.relname AS table_name,
            con.conname,
            con.contype,
            ARRAY(
              SELECT a.attname
              FROM unnest(con.conkey) WITH ORDINALITY AS key(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = key.attnum
              ORDER BY key.ord
            ) AS columns,
            fn.nspname AS foreign_schema,
            fc.relname AS foreign_table,
            ARRAY(
              SELECT fa.attname
              FROM unnest(con.confkey) WITH ORDINALITY AS key(attnum, ord)
              JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = key.attnum
              ORDER BY key.ord
            ) AS foreign_columns,
            con.confupdtype,
            con.confdeltype,
            pg_get_constraintdef(con.oid, true) AS definition
          FROM pg_constraint con
          JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          LEFT JOIN pg_class fc ON fc.oid = con.confrelid
          LEFT JOIN pg_namespace fn ON fn.oid = fc.relnamespace
          WHERE con.contype IN ('p', 'u', 'f')
            AND n.nspname = ANY($1)
          ORDER BY n.nspname, c.relname, con.contype, con.conname
        `,
    [schemas]
  );
  const { rows: enums } = await client.query(
    `
          SELECT
            n.nspname AS type_schema,
            t.typname AS enum_name,
            e.enumlabel,
            length(e.enumlabel) AS label_length,
            e.enumsortorder
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE n.nspname = ANY($1)
          ORDER BY n.nspname, t.typname, e.enumsortorder
        `,
    [schemas]
  );

  await client.end();

  const tableClassNames = new Map();
  const usedClassNames = new Set();
  for (const table of tables) {
    tableClassNames.set(
      qname(table.table_schema, table.table_name),
      toClassName(table.table_schema, table.table_name, usedClassNames)
    );
  }

  const columnsByTable = new Map();
  for (const column of columns) {
    const key = qname(column.table_schema, column.table_name);
    if (!columnsByTable.has(key)) columnsByTable.set(key, []);
    columnsByTable.get(key).push(column);
  }

  const constraintsByTable = new Map();
  for (const constraint of constraints) {
    constraint.columns = normalizePgArray(constraint.columns);
    constraint.foreign_columns = normalizePgArray(constraint.foreign_columns);
    const key = qname(constraint.table_schema, constraint.table_name);
    if (!constraintsByTable.has(key)) constraintsByTable.set(key, []);
    constraintsByTable.get(key).push(constraint);
  }

  const enumGroups = new Map();
  for (const row of enums) {
    const key = qname(row.type_schema, row.enum_name);
    if (!enumGroups.has(key)) {
      enumGroups.set(key, {
        typeSchema: row.type_schema,
        enumName: row.enum_name,
        labels: [],
        maxLength: 0,
      });
    }
    const group = enumGroups.get(key);
    group.labels.push(row.enumlabel);
    group.maxLength = Math.max(group.maxLength, row.label_length);
  }

  const enumChoiceNames = new Map();
  const usedEnumChoiceNames = new Set();
  for (const [key, group] of enumGroups.entries()) {
    enumChoiceNames.set(
      key,
      enumChoicesName(
        schemas.length > 1 ? `${group.typeSchema}_${group.enumName}` : group.enumName,
        usedEnumChoiceNames
      )
    );
  }

  const enumLengthByKey = new Map(
    [...enumGroups.entries()].map(([key, group]) => [key, group.maxLength || 255])
  );
  for (const column of columns) {
    const enumKey = qname(column.udt_schema, column.udt_name);
    const elementEnumKey = qname(column.element_udt_schema, column.element_udt_name);
    if (enumLengthByKey.has(enumKey)) column.enum_max_length = enumLengthByKey.get(enumKey);
    if (enumLengthByKey.has(elementEnumKey)) {
      column.element_enum_max_length = enumLengthByKey.get(elementEnumKey);
    }
  }

  const lines = [];
  lines.push("# 从当前 Carbon PostgreSQL 实例生成。");
  lines.push("# 数据源：.env.local / packages/database/.env 中的 SUPABASE_DB_URL。");
  lines.push("# 范围：schema " + schemas.map((schema) => `"${schema}"`).join(", ") + "。");
  lines.push("#");
  lines.push("# 这些模型是 unmanaged 的读写映射，用于检查、集成或 Django 侧访问 Carbon 数据。");
  lines.push("# 不要让 Django 使用这些模型创建或迁移 Carbon 数据表。");
  lines.push("");
  lines.push("from django.db import models");
  lines.push("from django.contrib.postgres.fields import ArrayField");
  lines.push("");

  if (enumGroups.size > 0) {
    lines.push("");
    for (const [key, group] of enumGroups.entries()) {
      const name = enumChoiceNames.get(key);
      lines.push(`# PostgreSQL 枚举：${key}`);
      lines.push(`${name} = (`);
      for (const label of group.labels) {
        lines.push(`    (${py(label)}, ${py(label)}),`);
      }
      lines.push(")");
      lines.push("");
    }
  }

  for (const table of tables) {
    const tableKey = qname(table.table_schema, table.table_name);
    const className = tableClassNames.get(tableKey);
    const tableColumns = columnsByTable.get(tableKey) || [];
    const tableConstraints = constraintsByTable.get(tableKey) || [];
    const primaryConstraint = tableConstraints.find((constraint) => constraint.contype === "p");
    const primaryKeyColumns = primaryConstraint?.columns || [];
    const uniqueConstraints = tableConstraints.filter((constraint) =>
      ["p", "u"].includes(constraint.contype)
    );
    const uniqueSingleColumns = new Set(
      tableConstraints
        .filter((constraint) => constraint.contype === "u" && constraint.columns.length === 1)
        .map((constraint) => constraint.columns[0])
    );
    const fkByColumn = new Map();
    for (const constraint of tableConstraints.filter((constraint) => constraint.contype === "f")) {
      if (constraint.columns.length === 1 && constraint.foreign_columns.length === 1) {
        fkByColumn.set(constraint.columns[0], constraint);
      }
    }

    lines.push("");
    lines.push("");
    lines.push(`class ${className}(models.Model):`);
    lines.push(`    """${tableDoc(table).replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}"""`);
    if (primaryKeyColumns.length > 1) {
      lines.push(
        `    # 当前 Django 模型无法完全表达 PostgreSQL 复合主键，真实主键字段为：${primaryKeyColumns.join(", ")}。`
      );
    } else if (primaryKeyColumns.length === 0 && tableColumns.length > 0) {
      lines.push(
        "    # PostgreSQL 中未检测到主键；这里把第一列标为 primary_key，避免 Django 自动增加隐式 id。"
      );
      primaryKeyColumns.push(tableColumns[0].column_name);
    }
    for (const constraint of tableConstraints.filter(
      (item) => item.contype === "f" && item.columns.length > 1
    )) {
      lines.push(
        `    # PostgreSQL 复合外键：(${constraint.columns.join(", ")}) 关联 ${constraint.foreign_schema}.${constraint.foreign_table}(${constraint.foreign_columns.join(", ")})，删除时 ${constraintAction(constraint.confdeltype)}。`
      );
    }

    const usedFieldNames = new Set();
    const columnToFieldName = new Map();
    for (const column of tableColumns) {
      columnToFieldName.set(
        column.column_name,
        buildFieldName(column.column_name, usedFieldNames)
      );
    }

    for (const column of tableColumns) {
      const fieldName = columnToFieldName.get(column.column_name);
      const fk = fkByColumn.get(column.column_name);
      const fieldSpec = fk
        ? relationField(column, fk, { tableClassNames })
        : mapColumnField(column, { enumChoiceNames });
      const args = fieldArgs(
        column,
        fieldName,
        fieldSpec,
        fk,
        primaryKeyColumns,
        uniqueSingleColumns
      );
      lines.push(`    # ${columnLineComment(column)}`);
      if (fk) {
        lines.push(
          `    # 外键：关联 ${fk.foreign_schema}.${fk.foreign_table}(${fk.foreign_columns.join(", ")})，删除时 ${constraintAction(fk.confdeltype)}。`
        );
      }
      lines.push(`    ${fieldName} = ${fieldSpec.field}(${args.join(", ")})`);
    }

    lines.push("");
    lines.push("    class Meta:");
    lines.push("        managed = False");
    lines.push(`        db_table = ${py(dbTableName(table.table_schema, table.table_name))}`);
    lines.push(`        verbose_name = ${py(tableDoc(table))}`);
    lines.push(`        verbose_name_plural = ${py(tableDoc(table))}`);

    const uniqueTuples = uniqueTogether(uniqueConstraints, primaryKeyColumns).map((columns) =>
      columns.map((columnName) => columnToFieldName.get(columnName) || columnName)
    );
    if (uniqueTuples.length > 0) {
      lines.push("        unique_together = (");
      for (const tuple of uniqueTuples) lines.push(`            ${renderTuple(tuple)},`);
      lines.push("        )");
    }
  }

  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(
    JSON.stringify(
      {
        outputPath,
        schemas,
        tables: tables.length,
        columns: columns.length,
        constraints: constraints.length,
        enums: enumGroups.size,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

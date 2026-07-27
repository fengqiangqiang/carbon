# 01 · Items / Parts / 制造方法

更新日期：2026-07-24
范围：Part 详情与身份、Item 字段与 sourcing、ItemReplenishment、MakeMethod / MethodMaterial / MethodOperation、SupplierProcess、修订与方法版本操作、与报价和外协采购相关的方法语义
关联：[`00-overview.md`](./00-overview.md) · 报价成本细节见 [`02-sales-quote-to-cash.md`](./02-sales-quote-to-cash.md)

---

## A. Part 详情页与身份模型

### A.1 页面结构（实测）

示例：`/x/part/item_LQcMEFbSyUiu6dfuurokTE/details`

| 区域 | 内容 |
|---|---|
| 左 | Manufacturing / Used In（含 Revisions） |
| 中 | Details：方法工具、Manufacturing、配置、Notes、BoM、BoP、Files、CAD、Risks |
| 右 | Properties（含补货策略、Sourcing、跟踪等） |

### A.2 身份对应

| 页面看到的 | 实际模型 |
|---|---|
| URL `item_…` | `Item.id`（修订级） |
| 显示编号如 `11113FDF` | `Item.readableId` = `Part.id` |
| 修订号 | `Item.revision` |
| 方法 V1/V2 | `MakeMethod.version`（与 revision **不同维**） |

```text
Part 1 ──N→ Item（修订）
Item 1 ──1→ ItemReplenishment
Item 1 ──N→ MakeMethod
```

### A.3 Part 字段实际参与情况

`Part` **不是**交易主档；报价/订单/工单/库存一律 `itemId → Item.id`。

| 字段 | 实际使用 | 说明 |
|---|---|---|
| `id` | ✅ | 编号家族键 = `Item.readableId` |
| `companyId` | ✅ | 与 `id` 组成复合主键 |
| `customFields` | ✅ | Details / New Part / 列表自定义列 |
| `tags` | ✅ | 标签 |
| 审计字段 | ✅ | created/updated |
| `approved` / `approvedBy` / `fromDate` / `toDate` | 基本未用 | 模型保留，当前主路径几乎不消费 |

名称、补货系统、跟踪类型、默认取得方式等属于 **Item**，不属于 Part。

### A.4 更新路径风险

Details 路由默认 action 可能把 URL 中的 `itemId`（`Item.id`）传给 `upsertPart`，而其更新分支按 `part.id` 匹配。版本化后 `part.id` 实际是 `readableId`，因此存在 **`part.customFields` 更新不到记录** 的风险。改编号/自定义字段时应核对实际写入的是 Part 行还是仅 Item。

### A.5 Details 的 `Risks` 风险登记

核对页面：`/x/part/item_M32SinZQ75TRDmJptpiCWD/details`，页面显示 Part 编号 `P-PART`。当前实测状态是：页面有 `Risks` 区块和 `Add Risk` 按钮，但该 Part 目前没有风险行。

这个区块不是 `Part` 模型字段，也不是 BoM/BoP 的工艺风险字段；它复用 Quality 模块的风险登记卡片，并把当前 URL 参数作为物料主档风险来绑定：

```text
Part Details URL itemId
  = Item.id
  -> RiskRegister.source = "Item"
  -> RiskRegister.sourceId = Item.id
  -> RiskRegister.itemId = Item.id
```

读取列表时，卡片按 `companyId + source + sourceId` 查询 `riskRegister`，并按 `createdAt` 倒序显示。`itemId` 会在新建风险时一起写入，用于说明这条风险关联哪个物料，也用于 Quality 风险总表显示/筛选物料；但在 Part Details 这个卡片里，真正决定“属于当前页面”的条件是 `source="Item"` 和 `sourceId=<当前 Item.id>`。

#### 现实业务含义

`Risks` 表示这一个具体 Item 修订的质量/交付/工程风险登记。它用于记录“这个物料本身有什么需要跟踪的风险或机会”，例如关键特性失效、供应或制造风险、质量改进机会等。因为绑定的是 `Item.id`，不同修订的风险可以分开维护；它不是整个 `Part.id/readableId` 编号家族共享的风险。

#### 对应 Django 模型和实际字段

| 页面/业务含义 | Django 模型及字段 | 说明 |
|---|---|---|
| 风险记录本体 | `RiskRegister.id` | 风险行主键；编辑、删除、负责人快速分配都靠它定位。 |
| 公司隔离 | `RiskRegister.companyId -> Company` | 只显示当前公司下的风险；也是 RLS/查询条件的一部分。 |
| 绑定当前 Part Details | `RiskRegister.source`、`RiskRegister.sourceId` | 本页固定写入/读取 `source="Item"`，`sourceId=当前 Item.id`。这才是本页风险归属的核心关系。 |
| 绑定物料主档 | `RiskRegister.itemId -> Item.id` | 新建时带入当前 `itemId`；Quality 风险总表可用它显示物料编号。它不是 `Part.id`。 |
| 标题 | `RiskRegister.title` | 卡片主标题；新建/编辑必填。 |
| 描述 | `RiskRegister.description` | 卡片正文摘要和表单说明，可为空。 |
| 类型 | `RiskRegister.type` | `Risk` 或 `Opportunity`，用于区分负面风险和正向机会。 |
| 状态 | `RiskRegister.status` | `Open`、`In Review`、`Mitigating`、`Closed`、`Accepted`，表示识别、评审、缓解、关闭或接受风险。 |
| 严重度 | `RiskRegister.severity` | 1-5 分，表示影响程度；数据库约束限制在 1 到 5。 |
| 发生可能性 | `RiskRegister.likelihood` | 1-5 分，表示发生概率；数据库约束限制在 1 到 5。 |
| 负责人 | `RiskRegister.assignee -> User.id` | 风险负责人；卡片底部可快速改负责人。新建未填时会默认当前用户。 |
| 备注 | `RiskRegister.notes` | 富文本 JSON 备注，可上传图片到私有存储，适合放评审、缓解计划或跟进记录。 |
| 创建/更新时间 | `RiskRegister.createdBy/createdAt/updatedBy/updatedAt` | 本页使用 `createdAt` 做倒序展示；其余主要是审计，不作为风险业务内容展开。 |

#### 本页不展开的字段/结构

- `Part` 模型不承载 Risks；此处只通过 `Item.id` 间接进入风险登记。
- `riskRegisters` view 是 Quality 风险总表读取用的视图，会额外带 `workCenterName/workCenterId`；Part Details 的卡片直接读 `riskRegister` 表，不使用这些 Work Center 派生字段。
- `riskSource` 枚举还包含 `Customer`、`General`、`Job`、`Quote Line`、`Supplier`、`Work Center`，但当前 Part 页面只使用 `Item`。

---

## B. Item 作为跨模块统一主档

### B.1 核心业务字段分组

| 分组 | 字段 |
|---|---|
| 身份 | `id`、`readableId`、`revision`、`readableIdWithRevision` |
| 分类描述 | `name`、`description`、`type`（Part/Material/Tool/Consumable/Service/…） |
| 供应策略 | `replenishmentSystem`、`defaultMethodType`、`sourcingType` |
| 库存控制 | `itemTrackingType`、`unitOfMeasureCode` |
| 状态质量 | `active`、`requiresInspection` |
| 工程资料 | `notes`、`modelUploadId`、`thumbnailPath` |
| 系统 | `companyId`、审计字段；`embedding`（后台）；`trackingMethod`（遗留，应用基本不用） |

### B.2 关联模块（均通过 `itemId`）

Items、Sales、Purchasing、Production/MES、Inventory、Planning、Quality、Accounting、Resources（维修用料）等。具体单据级关系写入后续采购/生产/库存专册。

### B.3 `Item.sourcingType`

仅当 `replenishmentSystem = Buy and Make` 时，在 Part/Tool Properties 显示。

| 值 | 行为摘要 |
|---|---|
| `Specified` | 不自动改 `defaultMethodType`；由主档明确 Purchase to Order / Pull from Inventory / Make to Order。**不**表示已指定供应商 |
| `Drop Ship` | 强制 `defaultMethodType = Purchase to Order`；级联更新引用该 Item 的 **Draft** `MethodMaterial` |
| `Ship from Inventory` | 强制偏向库存拉取策略；同样级联 Draft BoM 行 |

要点：

- BoM 上的 Sourcing **只读镜像**，改策略回组件 Item
- 级联通常只动 **Draft** 方法材料行；Active/Archived 不随手改
- 供应商仍由 `SupplierPart`、`preferredSupplierId`、阶梯价、PO 决定

---

## C. 如何生成「一对多」：修订与方法版本（前端操作）

### C.1 同 Part → 多 Item（新建修订）

路径：Part 详情左侧 **Used In → Revisions → + Create → New Revision**
提交：`/x/items/revisions/new` → `createRevision`

- **不**新建 Part
- 非 Buy 场景可通过 `itemToItem` 复制方法到新修订

### C.2 同 Item → 多 MakeMethod（方法版本）

路径：Details 顶部版本菜单 **Copy Version / New Version**
提交：`/x/items/methods/version/new` → `upsertMakeMethodVersion` + `makeMethodToMakeMethod`

### C.3 不会新建 Item / 方法版本的操作

| 操作 | 实际效果 |
|---|---|
| Get Method / Save Method | 在方法间复制内容，不新建修订 |
| Edit BoM / BoP | 编辑当前 Draft（或按权限） |
| Set Active | 改状态并改写相关 `materialMakeMethodId`；**不**新建版本 |

---

## D. 补货与制造方法字段详解

以下并入专题笔记原文，并与上文身份/操作说明交叉引用。

本文档汇总以下模型的字段含义、实际业务作用及上下游功能：

- `ItemReplenishment`
- `MakeMethod`
- `MethodMaterial`
- `MethodOperation`

分析依据为当前代码、数据库迁移、服务函数和实际页面逻辑，而不是仅依据模型外键。

---

## 一、ItemReplenishment

### 1. 模型定位

`ItemReplenishment` 是 `Item` 的修订级一对一扩展：

```text
Item（具体修订）
    1
    │ itemId
    1
ItemReplenishment
```

每次创建 `Item` 时，数据库拦截器自动创建一条 `ItemReplenishment`。不同 Item 修订各自拥有独立参数，不跨修订共享。

它同时承载：

- 采购参数；
- 制造参数；
- 采购和制造共用的 Item 级提前期。

### 2. 字段说明

#### `itemId`

所属 Item 修订，也是该记录的业务主键。

所有采购、制造、计划和配置功能都以具体 `Item.id` 查询这条记录。

#### `preferredSupplierId`

计划采购时优先选择的供应商。

它不是唯一允许供应商；同一个 Item 仍可通过多个 `SupplierPart` 关联多个供应商。

上游来源：

- Item Purchasing 页面手工选择；
- 采购价格回写根据实际采购供应商自动更新。

下游功能：

- Purchasing Planning 默认供应商；
- MRP 采购建议转采购订单；
- 采购计划按供应商分组。

#### `purchasingUnitOfMeasureCode`

默认采购计量单位。

实际优先级：

```text
SupplierPart.supplierUnitOfMeasureCode
    ↓ 不存在
ItemReplenishment.purchasingUnitOfMeasureCode
    ↓ 不存在
Item.unitOfMeasureCode
```

主要进入：

- Supplier Quote Line；
- Purchase Order Line；
- Purchase Invoice Line；
- Purchasing Planning；
- Receipt 数量换算。

#### `conversionFactor`

采购单位转换成库存单位的换算系数：

```text
库存数量 = 采购数量 * conversionFactor
库存单位成本 = 采购单位价格 / conversionFactor
```

例如：

```text
1 BOX = 20 EA
conversionFactor = 20

采购 5 BOX
入库数量 = 5 * 20 = 100 EA
```

来源优先级：

```text
SupplierPart.conversionFactor
    ↓
ItemReplenishment.conversionFactor
    ↓
1
```

主要下游：

- Supplier Quote；
- Purchase Order；
- Purchase Invoice；
- Receipt；
- Kanban；
- MRP。

业务上应大于零，但当前 validator 只要求 `>= 0`。保存为零可能造成除零或错误换算。

#### `purchasingBlocked`

采购冻结标志。

当前可确认的效果：

- Purchasing Planning 创建采购订单时检查；
- 为 `true` 时跳过该 Item；
- 计划列表显示冻结状态。

当前限制：

- Purchasing 页面开关已注释；
- Validator 未接收该字段；
- 普通 UI 当前无法维护；
- 没有证据表明它统一阻止手工新增采购订单行。

因此它当前主要表示“计划采购冻结”，不是全系统采购禁用。

#### `manufacturingBlocked`

制造冻结标志。

当前明确效果：

1. Production Planning 自动创建工单时跳过该 Item；
2. 工单状态切换为 `Ready` 时阻止释放。

当前普通 Manufacturing 页面开关和 validator 同样已注释，因此字段后端有效、普通 UI 不可维护。

#### `requiresConfiguration`

标识该 Item 是否为可配置制造件。

开启后：

- Part Details 显示 Configuration Parameters；
- 可维护参数组、参数和配置规则；
- 新建 QuoteLine 时要求先填写配置；
- 报价方法复制时把配置应用到 BoM/BoP；
- 批量 Production Planning 不直接创建未配置工单；
- 某些 MakeMethod 复制操作会限制覆盖可配置 Item。

#### `lotSize`

默认制造批量，对应 Details 页面 `Batch Size`。

销售订单创建 Make-to-Order 工单时，默认数量为：

```text
min(剩余需求数量, lotSize)
```

`lotSize = 0` 时通常一次带出全部剩余需求。

主要下游：

- Sales Order 创建 Job；
- Production Planning 建议工单数量；
- BoM 导出。

它是软约束或默认值，不是数据库强制批量。

#### `scrapPercentage`

预计制造报废比例。

计算：

```text
预计报废数量 = ceil(生产数量 * scrapPercentage)
```

例如：

```text
生产数量 = 100
scrapPercentage = 0.05
预计报废数量 = 5
```

主要影响：

- 销售订单创建 Job；
- Job 数量更新；
- Make-to-Order 子件需求展开；
- JobMaterial 需求重算；
- 方法复制。

它产生预计需求，不代表 MES 实际报废。

#### `leadTime`

Item 级提前期，单位为天，默认值为 7。

采购侧用途：

- PO 默认到货日期；
- Purchasing Planning；
- MRP 采购需求倒排；
- 根据历史收货加权回写。

制造侧用途：

- Production Planning；
- Kanban 创建 Job 的 due date；
- MRP 子件交期倒排。

重要限制：

```text
Purchasing 页面 leadTime
和
Manufacturing 页面 leadTime
是同一个字段
```

对 `Buy and Make` 物料，当前模型不能分别保存采购提前期和制造提前期。

#### `customFields`

企业自定义补货或制造属性。

当前主要入口是 Manufacturing 表单中的：

```text
CustomFormFields table="partReplenishment"
```

核心 MRP 和工单代码不会自动解释这些值，需要企业扩展功能消费。

#### `tags`

补货记录标签数组。

当前没有发现 ItemReplenishment 页面上的标签入口，也没有发现核心采购、计划或生产逻辑直接读取它，属于保留字段。

#### `companyId`

公司租户边界。所有查询和更新必须限定公司。

#### 审计字段

- `createdBy`
- `createdAt`
- `updatedBy`
- `updatedAt`

页面保存、采购价格回写和提前期回写都会更新审计信息。

### 3. ItemReplenishment 上下游

```text
Item 创建
    ↓ 自动创建
ItemReplenishment
    ├── Purchasing 页面
    │     ├── preferredSupplierId
    │     ├── purchasingUnitOfMeasureCode
    │     ├── conversionFactor
    │     └── leadTime
    ├── Manufacturing 页面
    │     ├── lotSize
    │     ├── scrapPercentage
    │     ├── requiresConfiguration
    │     └── leadTime
    ├── Purchasing Planning / MRP
    ├── Production Planning / Job
    └── 采购历史回写
```

---

## 二、MakeMethod

### 1. 模型定位

`MakeMethod` 是某个具体 Item 修订的制造方法版本头：

```text
Item 1 → N MakeMethod
```

Part 或 Tool 类型的 Item 创建后，系统自动生成 V1 Draft。

### 2. 字段说明

#### `id`

制造方法版本主键。

下游引用：

- `MethodMaterial.makeMethodId`
- `MethodOperation.makeMethodId`
- `MethodMaterial.materialMakeMethodId`
- 方法复制和激活操作

#### `itemId`

所属的具体 Item 修订。

同一 Part 的不同 Item revision 可以拥有完全不同的制造方法。

#### `version`

同一个 Item 内的制造方法版本号。

`Item.revision` 与 `MakeMethod.version` 是两个不同维度。

#### `status`

状态：

- `Draft`：可编辑；
- `Active`：正式使用，BoM/BoP 只读；
- `Archived`：历史保留。

Quote 和 Job 通常从 Active 方法复制。页面没有 Active 时可能回退显示 Draft，但能显示不等于正式生效。

#### `companyId`

租户边界。

#### `customFields`

制造方法级扩展 JSON。当前主工具栏没有明显通用编辑入口。

#### `tags`

制造方法版本标签。

#### 审计字段

- `createdBy`
- `createdAt`
- `updatedBy`
- `updatedAt`

### 3. 生命周期

```text
Item 创建
    ↓
MakeMethod V1 Draft
    ↓ 编辑 BoM/BoP
Active
    ↓ 复制新版本
MakeMethod V2 Draft
```

Active/Archived 方法应视为冻结模板。修改时应复制为新 Draft。

---

## 三、MethodMaterial

### 1. 模型定位

`MethodMaterial` 是制造方法的 BoM 组件行：

```text
MakeMethod 1 → N MethodMaterial
```

### 2. 字段说明

#### `id`

BoM 行主键，用于编辑、删除、排序、配置规则和方法复制。

#### `makeMethodId`

所属制造方法版本。

#### `itemId`

组件的具体 Item 修订。报价、Job、拣货和发料都沿用这个修订身份。

#### `itemType`

组件类型快照，例如 Part、Material、Tool、Consumable、Service。

报价时决定成本桶。

#### `methodType`

取得方式：

- `Purchase to Order`
- `Pull from Inventory`
- `Make to Order`

它以组件 `Item.defaultMethodType` 为权威来源，服务端保存时会重新读取 Item。

#### `sourcingType`

组件 `Item.sourcingType` 的只读镜像。

修改来源策略应回到组件 Item 主档。

#### `materialMakeMethodId`

Make-to-Order 组件自己的 Active MakeMethod。

它使方法树可以递归展开子装配件。

#### `quantity`

生产一个父节点所需的基础用量。

嵌套数量：

```text
组件实际需求 =
父节点展开数量 * MethodMaterial.quantity
```

#### `scrapQuantity`

Schema 支持的额外报废数量。

当前 BoM 表单和 validator 不直接维护；Quote/Job 通常重新读取组件 `ItemReplenishment.scrapPercentage` 计算报废需求。

#### `productionQuantity`

数据库生成字段：

```text
productionQuantity = quantity + scrapQuantity
```

QuoteMaterial 和 JobMaterial 会形成自己的数量快照和重算结果。

#### `unitOfMeasureCode`

组件需求单位，通常来自组件 Item 基础单位。

#### `order`

BoM 行排序值。

#### `methodOperationId`

可选的领料工序。用于工序级齐套、拣料和发料。

#### `kit`

区分 Make-to-Order 组件是：

- `Kit`
- `Subassembly`

Kit 更偏向成套组织和成套发料。

#### `storageUnitIds`

按 Location 保存默认 StorageUnit 的 JSON：

```json
{
  "location_a": "storage_unit_1",
  "location_b": "storage_unit_7"
}
```

来源通常是组件的 PickMethod。

#### `customFields`

BoM 行扩展 JSON，当前主表单没有明显入口。

#### `tags`

BoM 行标签，当前编辑器没有维护入口。

#### `companyId` 与审计字段

- `companyId`
- `createdBy / createdAt`
- `updatedBy / updatedAt`

### 3. MethodMaterial 下游

```text
MethodMaterial
    ├── QuoteMaterial
    │     └── 报价材料/零件/工具/服务成本
    └── JobMaterial
          ├── MRP
          ├── Picking
          ├── Issue
          ├── Backflush
          └── TrackedEntity
```

---

## 四、MethodOperation

### 1. 模型定位

`MethodOperation` 是制造方法的 BoP 工序行：

```text
MakeMethod 1 → N MethodOperation
```

并拥有子表：

```text
MethodOperation
    ├── MethodOperationParameter
    ├── MethodOperationStep
    └── MethodOperationTool
```

### 2. 字段说明

#### `id`

工序模板主键。

#### `makeMethodId`

所属制造方法版本。

#### `order`

工序显示和复制排序。

#### `operationOrder`

与前一道工序的衔接方式：

- `After Previous`：顺序执行；
- `With Previous`：允许并行。

复制到 Job 后形成实际的 `JobOperationDependency`。

#### `description`

工序说明，显示于 BoP、Quote、Job、Traveler 和 MES。

#### `processId`

必选标准 Process，影响工艺分类、可选 WorkCenter、SupplierProcess 和 Procedure。

#### `workCenterId`

内部加工工作中心，用于产能、排程、设备和成本。

#### `operationType`

- `Inside`：内部加工；
- `Outside`：外协加工。

#### `operationSupplierProcessId`

外协供应商工艺能力，连接 `SupplierProcess.id`。它选择的不是普通 `SupplierPart`，而是“某供应商可以承接某种 Process”的能力记录。

`SupplierProcess` 当前真正参与外协业务的字段如下：

| 字段 | 现实业务含义 | 实际作用 |
|---|---|---|
| `id` | 一条供应商工艺能力记录 | 被 Method、Quote、Job 工序选择，并用于解析具体供应商 |
| `supplierId` | 谁来承接外协加工 | 外协采购按它归集到供应商；外协质量问题按它关联责任供应商 |
| `processId` | 该供应商能承接什么工艺 | 按 Process 过滤候选供应商；同一供应商和 Process 只能有一条记录 |
| `minimumCost` | 承接一次该工艺的默认最低收费 | 作为工序 `operationMinimumCost` 的默认来源 |
| `leadTime` | 完成该工艺通常需要的标准天数 | 作为工序 `operationLeadTime` 的默认来源，复制到 Job 后影响排程 |

`SupplierProcess` 不是供应商报价或价格阶梯表。它曾经有 `unitCost`，但当前模型已删除该字段；外协单位价格保存在具体工序的 `operationUnitCost` 快照上。

选择 Process 时，Item、Quote、Job 工序编辑器会读取该 Process 下所有 SupplierProcess，并用 `minimumCost` 和 `leadTime` 的简单平均值初始化估算。指定具体 SupplierProcess 后，Quote/Job 编辑器会改用该供应商的精确最低收费和提前期；Item 的 Method 编辑器当前没有同样的选择后回填，因此保存前仍可能保留平均值或人工修改值。

#### `setupTime / setupUnit`

准备时间和计量方式。

影响：

- Quote setupHours；
- Setup 人工和制造费用；
- Job 排程。

#### `laborTime / laborUnit`

人工标准工时。

影响 Quote 人工成本、Job 工时、MES Labor Event 和人员排程。

#### `machineTime / machineUnit`

设备标准工时。

影响 Quote 设备成本、JobOperation 设备负荷和 MES Machine Event。

#### `procedureId`

标准作业程序，可带入：

- 参数；
- 步骤；
- 工具；
- 检验要求。

#### `workInstruction`

结构化作业指导书 JSON，进入 Quote、Job、Traveler 和 MES。

#### `operationMinimumCost`

某一道外协工序无论加工数量多少，供应商至少要收取的金额。它是整批外协工序的收费下限，不是每件再收一次的固定附加费。

#### `operationUnitCost`

供应商每加工一个工序计价单位收取的费用。它不是人工费、机器费或材料采购价，而是完整外协加工服务的单位价格。

当前 SupplierProcess 不提供单位价。该值通常来自 Method/Quote/Job 工序上的人工输入或快照复制；外协采购形成实际价格后，系统只会把采购行单价更新到对应 `JobOperation.operationUnitCost`，不会回写 MethodOperation 或 SupplierProcess。

Quote 和外协采购按批量计算：

```text
按量费用 = operationUnitCost * 外协工序数量
外协费用 = max(operationMinimumCost, 按量费用)
```

Quote 中的“外协工序数量”还会包含方法树节点数量和报价数量；从 Job 创建外协采购行时则使用 `JobOperation.operationQuantity`。如果最低收费占主导，采购行会把整批最低收费除以采购数量，摊回 `supplierUnitPrice`。

例如最低收费为 500、单位加工费为 8、数量为 40：按量费用是 320，估算外协费用仍为 500；生成 40 件的采购行时，初始单位价格为 12.5。

Method 的 BOM/标准单件成本是一个不同实现：当前代码直接取 `max(operationMinimumCost, operationUnitCost)`，没有乘批量，也没有按批量摊薄最低收费。因此它可能与 Quote/PO 的批量外协成本不同。

#### `operationLeadTime`

这道外协工序需要预留的供应商加工/周转天数。它不是 Setup、Labor 或 Machine 工时，也不参与外协金额公式。

MethodOperation 保存的是模板值。真正排程读取复制或推导后的 `JobOperation.operationLeadTime`，并把它作为工序依赖之间的工作日偏移，用于正向或反向推算开始、完成日期。修改 MethodOperation 或 SupplierProcess 不会自动更新、重排已经存在的 Job。

它不同于 `ItemReplenishment.leadTime`：

- ItemReplenishment：整个 Item 的补货/制造提前期；
- MethodOperation：某一道外协工序未来进入 Job 时使用的提前期模板；
- JobOperation：排程器真正读取的执行快照。

该字段当前不会直接填写外协采购单的 `requiredDate`、`promisedDate` 或交货日期。

#### `tags`

工序标签。BoP 页面存在实际维护入口。

#### `customFields`

工序扩展 JSON，当前主表单没有明显通用入口。

#### `companyId` 与审计字段

- `companyId`
- `createdBy / createdAt`
- `updatedBy / updatedAt`

### 3. MethodOperation 下游

```text
MethodOperation
    ├── QuoteOperation 快照
    │     └── operationMinimumCost / operationUnitCost → outsideCost
    └── JobOperation 快照
          ├── operationLeadTime → 工作日排程
          ├── operationSupplierProcessId → 外协采购供应商 / 质量责任供应商
          ├── operationMinimumCost / operationUnitCost → 外协采购初始价格
          ├── JobOperationDependency / Parameter / Step / Tool
          └── ProductionEvent / ProductionQuantity
```

SupplierProcess 的数据不会在每次成本计算时实时查询。生成 QuoteOperation 或 JobOperation 时，系统将供应商、最低收费、单位价和提前期保存成工序快照；之后修改 SupplierProcess 主数据，不会追溯更新已有 Quote 或 Job。

> **当前实现差异：** Method 转 Quote/Job 的入口不只一条，不同路径对三个字段的处理并不完全一致。有的精确复制 MethodOperation，有的根据当前 SupplierProcess 重新计算最低收费和提前期；配置型 Item 转 Job 的一条路径还没有复制 `operationUnitCost`，会使用数据库默认值 0。因此不能把所有下游工序都理解为完全一致的模板副本。

### 4. 本节代码核对路径

- SupplierProcess 表、唯一约束和 Method/Quote 工序关系：[`20240823024502_outside-operations.sql`](../../packages/database/supabase/migrations/20240823024502_outside-operations.sql)
- SupplierProcess 删除 `unitCost`：[`20241115011318_remove-supplier-process-unit-cost.sql`](../../packages/database/supabase/migrations/20241115011318_remove-supplier-process-unit-cost.sql)
- SupplierProcess 默认值与平均值解析：[`methods.ts`](../../packages/database/supabase/functions/lib/methods.ts)
- Method 的 BOM/标准成本：[`bom.ts`](../../apps/erp/app/utils/bom.ts)
- Quote 外协成本：[`useLineCosts.tsx`](../../apps/erp/app/modules/sales/ui/Quotes/useLineCosts.tsx)
- Job 外协采购单生成：[`create/index.ts`](../../packages/database/supabase/functions/create/index.ts)
- 外协采购实价回写 JobOperation：[`update-purchased-prices/index.ts`](../../packages/database/supabase/functions/update-purchased-prices/index.ts)
- Job 工作日排程：[`date-calculator.ts`](../../packages/database/supabase/functions/lib/scheduling/date-calculator.ts)
- 外协质量责任供应商关联：[`quality.service.ts`](../../apps/erp/app/modules/quality/quality.service.ts)

---

## 五、端到端关系

```text
Item 修订
    ↓
MakeMethod
    ├── MethodMaterial
    │      ↑ Item / ItemReplenishment / PickMethod
    └── MethodOperation
           ↑ Process / WorkCenter / SupplierProcess / Procedure

                    ↓ 深拷贝
        ┌───────────┴───────────┐
        ↓                       ↓
QuoteMakeMethod            JobMakeMethod
QuoteMaterial              JobMaterial
QuoteOperation             JobOperation
        ↓                       ↓
报价成本与交期             计划、拣料、MES、报工
```

## 六、关键边界和已知问题

1. Active/Archived 方法只读，应复制出新 Draft 再修改。
2. MethodMaterial 的 methodType/sourcingType 以组件 Item 为准。
3. Quote 和 Job 是深拷贝快照，不自动跟随主工艺变化。
4. MethodMaterial.scrapQuantity 当前不是 BoM 表单的主要报废来源。
5. 当前 `Pieces/Minute` 报价工时换算使用 `1 / (time / 60)`，业务上应为 `1 / (time * 60)`，会放大 3600 倍。
6. SupplierProcess 只维护能力、最低收费和提前期，不维护单位加工价格；单位价属于具体工序快照。
7. Method 的标准单件外协成本与 Quote/PO 的批量公式不同，最低收费在标准成本中没有按批量摊薄。
8. Method 转 Quote/Job 的不同创建路径对最低收费、单位价和提前期的复制/刷新规则尚未统一。


---

## E. 与报价成本的接口（摘要）

方法树进入报价后成为 `QuoteMaterial` / `QuoteOperation` 快照。与 Item/Method 强相关的两点：

### E.1 Purchase to Order 阶梯价

```text
requestedQty = 方法树展开后的物料用量 × 报价数量
resolvedUnitCost = 阶梯中 quantity <= requestedQty 且门槛最高的单价（整批，非累进）
fallback: SupplierPart.unitPrice（多供应商取最低）→ QuoteMaterial.unitCost
```

完整示例与代码路径见销售专册 Costing / Pricing 章节。

### E.2 `setupUnit`（准备时间单位）

- `Total Hours` / `Total Minutes`：整批固定，不乘产量
- 其余单位：先换算每件小时，再 × 报价数量 × 方法树节点数量
- 成本进 labor / overhead，**不**进 machineRate

> **缺陷：** `Pieces/Minute` 业务上每件小时应为 `1/(setupTime*60)`；当前报价实现用 `1/(setupTime/60)`，约放大 3600 倍。

---

## F. 本章核对清单

- [x] Part.id ≠ Item.id；Part.id = readableId
- [x] sourcingType 仅 Buy and Make；BoM 只读镜像
- [x] Replenishment 采购/制造共用 leadTime
- [x] MakeMethod 与 Item.revision 不同维
- [x] Quote/Job 深拷贝不回写
- [x] 修订 / 方法版本前端入口与不会新建的操作

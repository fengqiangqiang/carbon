# Carbon 业务与模型映射知识库

> 内部研究文档：依据 **当前代码 + 最新数据库迁移 + 页面实测** 整理，用于理解 Carbon ERP/MES 的真实业务语义与模型映射。
> **不是** 面向客户的 Fumadocs 产品文档（`docs/content/`）；本目录刻意放在 `docs/business-model/`，便于仓库内查阅，且不会进入正式文档站 IA。

更新日期：2026-07-24

## 本库定位

| 用途 | 说明 |
|---|---|
| 业务语义 | 页面控件、状态、字段在真实业务中的含义 |
| 模型映射 | 对应 `packages/database/models.py` / 表 / 服务函数 |
| 边界与缺陷 | 条件关系、只读镜像、已知实现问题 |
| 扩展底稿 | 后续按模块继续写入采购、生产、库存等 |

## 阅读顺序

1. [`00-overview.md`](./00-overview.md) — 业务全景、关键身份模型、内容规划
2. [`01-items-parts-methods.md`](./01-items-parts-methods.md) — 物料主数据、补货、制造方法、外协供应商工艺与 Item 风险登记（2026-07-24 整合）
3. [`02-sales-quote-to-cash.md`](./02-sales-quote-to-cash.md) — 客户 → RFQ → Quote → Order → Invoice / Shipment

## 内容规划（按 Carbon 现实业务域）

后续新模块请按此目录新增 `0N-*.md`，并在本 README 登记。

| 序号 | 计划文件 | 业务域 | 状态 | 核心实体（预期） |
|---:|---|---|---|---|
| 00 | `00-overview.md` | 全景与约定 | ✅ 已有 | Part/Item 身份、域地图 |
| 01 | `01-items-parts-methods.md` | Items / 工程方法 | ✅ 已有 | Part、Item、ItemReplenishment、MakeMethod、MethodMaterial/Operation、SupplierProcess、RiskRegister |
| 02 | `02-sales-quote-to-cash.md` | Sales 报价到回款 | ✅ 已有（原 master 重组） | Customer、SalesRfq、Quote、SalesOrder、SalesInvoice、Shipment |
| 03 | `03-purchasing-to-receipt.md` | Purchasing 询价到收货 | ⏳ 待写 | Supplier、SupplierPart、PO、Receipt、PurchaseInvoice |
| 04 | `04-production-jobs-mes.md` | Production / MES | ⏳ 待写 | Job、JobMaterial/Operation、Picking、Issue、ProductionEvent |
| 05 | `05-inventory-planning.md` | Inventory / Planning | ⏳ 待写 | ItemLedger、TrackedEntity、MRP、Kanban、Transfer |
| 06 | `06-quality-accounting.md` | Quality / Accounting | ⏳ 待写 | Inspection、NonConformance、ItemCost、CostLedger、GL |
| 07 | `07-resources-maintenance.md` | Resources / Maintenance | ⏳ 待写 | WorkCenter、Equipment、MaintenanceDispatch |

## 写作约定

1. **代码优先**：结论必须能落到路由、服务、迁移或 `models.py`；与通用 ERP 常识冲突时以 Carbon 为准。
2. **区分身份层**：`Part`（编号家族）≠ `Item`（修订级主档）≠ 单据快照（Quote*/Job*）。
3. **区分基数类型**：直接业务关系 / 条件关系 / 只读镜像 / 深拷贝快照，不要只写外键。
4. **记录已知缺陷**：实现与业务定义不一致时用引用块标明，避免被当成正确行为。
5. **页面实测**：涉及 UI 行为时注明核对日期与路由；未保存/未触发的副作用不要写成已验证。
6. **中文正文 + 英文实体名**：保留系统枚举原文字符串（如 `Purchase to Order`、`Buy and Make`）。

## 与旧文件的关系

| 旧路径 | 处置 |
|---|---|
| `.claude/scratch/tasks/carbon-business-model-mapping-master.md` | 销售章节已迁入 `02-sales-quote-to-cash.md`；该文件顶部改为指向本知识库 |
| `.claude/scratch/tasks/part-replenishment-methods-business-model-mapping.md` | 已并入 `01-items-parts-methods.md` |
| Cursor Canvas（part-details / relationships） | Windows 下链接不可靠；关键结论已落盘到本目录 Markdown |

## 快速业务地图

```text
Customer ──► SalesRfq ──► Quote ──► SalesOrder ──┬──► Job / MES
                                                 ├──► Shipment
                                                 └──► SalesInvoice

Item（修订）◄── Part（编号家族，Part.id = Item.readableId）
   │
   ├── ItemReplenishment（1:1 补货/制造参数）
   ├── MakeMethod（1:N 方法版本）── MethodMaterial / MethodOperation
   └── 被 Quote*/Job*/PO*/库存流水 等通过 itemId 引用
```

# 当前本地验收与独立审查

2026-11-28，HEAD `9938d04` 上的未提交候选；未安装、同步远程或启动流水线。独立审查来自[重新设计 requirement-flow 会话](codex://threads/01a2165b-b6ed-7de2-866d-ab932f654bc9)。此前限定原反例的复核只证明那些输入；按用户纠正，当前审核请求只有“帮我审核 requirement-flow”，不限定检查范围或预设结论。若执行与审核意见分歧，需连同双方依据、实际复现和影响告知用户。

## 当前结果与证据范围

本轮本地Beta验收与完整独立审核通过，没有剩余需修项。指定审核会话核对225个冻结角色文件的字节和模式，独立重跑6文件309项（内含Reader Python89项）全部通过，确认上轮配对故障状态P3已关闭。最终后端773b9e3e、Reader JS ee56c67b、核心604ea706；执行与审核无实证分歧。结论限于当前本地候选，不等同于全仓、真实业务部署或跨模型联用已通过。

[当前执行回执](reader-pair-errors-check.json)和[原始输出](reader-pair-errors-check.json.output.txt)由根独立 check 为 `execution=succeeded / freshness=current`：6个 Vitest 文件309项通过（role5、Reader五文件304，内部含reader89项、doctor22项等Python及安装投影），类型检查和10文件定点ESLint退出0。附加的type:module临时项目内doctor22项实际1.863秒通过，目录已清理。command/roots与recovery-copy候选完全相同，前后指纹`80c10882…ba25c320`一致。`current`只覆盖声明的输入；类型检查在采集时通过，跨检出需重新运行 `pnpm run typecheck`。

当前 Vitest 使用官方 `--configLoader runner` 加载正式配置。历史Reader UI候选曾在默认bundle加载器的RUN之前空闲等待，结束那轮子进程后保留[启动失败回执](reader-ui-final-check.json)；没有开始测试，不计通过。更早的[同类失败](peer-review-boundaries-check.json)及随后默认加载器成功的[18项回执](peer-review-boundaries-final-check.json)也保留，只代表各自候选。历史采样仅显示Node事件循环/Rolldown空闲、非暂停、自旋或输出背压，根因未确定；不因后续成功归因TMPDIR。未为绕过加载问题修改测试、放宽超时或改配置文件。

先前309项recovery-copy、309项known-errors、304项link-description、302项pending-proof、292项read-lifecycle-final、290项read-lifecycle、277项source-owner、267项directory-owner、263项catalog-scope、257项read-order、248项frame-concurrency、240项frame-status、214项catalog-errors、194项read-failures、155项navigation-state、145项reachable-context、144项task-recovery、142项rejected-state、133项source-state、121项dependent-sources、106项batch-cards、94项task-context、86项catalog-consistency、84项cold-handoff、75项lifecycle、64项pair-confidence、59项source-identity、57项model-cache、54项summary-pairs、50项scope-batch、47项author-anchors、两份45项reader-entry回执及32项、24项、20项和18项等成功回执因后续修源已stale，只证明各自历史输入，不代表当前候选。最近257项候选的完整独立审查关闭原请求顺序/弹窗输入；新发现单任务成功与目录失信的作用范围随送达顺序变化，执行方认同并修复，连同批量读取的同根错误分支一起核对。根以两份独立IAB、真实HTTP响应换序验证相同可操作结果，并确认旧历史返回没有暗中刷新、整批及R2刷新恢复有效。各SHA和实测输入分别记录，不把309项测试当完整独立审核已过；子审查只核它声明的范围；当前最终候选的完整独立审核已通过，详见顶部。

历史pair-confidence候选的两份失败回执也保留：[首轮](reader-pair-confidence-check.json)的63项已通过，但新增测试缺少类型注解导致typecheck失败，后续lint/ESM未执行；补注解后的[第二轮](reader-pair-confidence-final-check.json)为62/63，角色测试子进程达到原有60秒上限。其输出包含Reader59项OK及夹具mkdir堆栈，不能据此确定超时根因；该轮后续检查未执行。没有调整超时或配置。该阶段修正类型与超限提示、清理验证资源后，同命令采集得到[64项成功回执](reader-pair-confidence-ui-check.json)，现在也已stale。两份失败原始记录同样保留，不把该阶段重跑成功当成根因已证明，更不作为当前候选的通过依据。

## 用户最新页面意见

- 左侧业务/任务目录统一单行省略。真实H5长任务标题在键盘聚焦与实际鼠标悬停下显示完整tooltip，`aria-describedby`关联正确；目录自动滚动后的提示保持显示，手动滚动、Escape、换页和resize可以关闭。
- 导航滚动条为细thumb、透明轨道，宣纸/夜墨均实际核对；键盘PageDown实际从0滚到538.75。切换选中态为朱砂文字/细边底线，计数较弱，不再是大块绿色。
- 实际CSS视口为576×744、1600×1000、450×930；无横向溢出，窄屏tooltip在视口内，闭合目录不进入屏外焦点。测试viewport覆盖已重置，主题恢复宣纸。最新原生IAB截图已内联显示。
- `.requirements/rules/index.md`没有原文分类标记，分类条为空且display:none。只有已标记章节才提供有内容的分类；这不是要求每份文档创建三类栏目。
- 1110字目录tooltip在实际1350×640视口跨8px间隙进入后仍可滚到底，`scrollTop=257.5 / clientHeight=623 / scrollHeight=880`，实际读到末尾；Escape关闭，viewport已reset。最后真实任务页实际636×744，无横向溢出、仅一条侧栏选中，恢复宣纸并收起目录。

真实陈列只读预览为 `http://127.0.0.1:61789/`，已经打开H5返图任务、规则入口和来源。真实项目在其它工作中持续变化，记录只说明当时读取的版本；原图页里的4/4等业务状态沿用原文，不能当成本轮业务验收。

## 阅读、任务与交接路径

原始复现与直接相关路径已实际修复并逐轮独立复核；每轮只按它自己的输入认定。下文各阶段的“当前”“待返回”保留当轮冻结时状态，最终状态见本页顶部及最新附件；历史回执不因后续通过而恢复current。

- 目录标题/链接复用同包Marked及离线parse5；注释、代码伪链接和明确hidden子树不收录，合法嵌套/转义/行内代码标签、重复引用首定义、实体和百分号语义保留。Markdown仍是业务内容源。
- 原文先在未挂载的惰性template中移除hidden，再执行原DOMPurify配置，避免控件解包泄出隐藏文字。正文、搜索、卡片、标题和目录共用可见文本边界；br/块间隔不拼词，inline强调不拆词。首段优先独立正文，不把折叠历史或引用里的“可以交付”升格为当前结论；卡片与tooltip都显示“本轮已退回，必须补实测”。
- 标题保留作者的依据链接；失效链接也保留已净化的br/strong/code及原原因提示。移除terms.md后，先前复制的store-approval深链、目录和别名仍稳定；无“未找到章节”提示。
- 引用、列表、details内部的分类不改变外部后续内容。summary里的显式标题也有分类和锚点，作用于本折叠正文；现状只七天、拟议只十四天，容器外恢复七天。summary保持直接子项，可原生开合；从目录或复制深链进入时展开全部祖先。
- 分类同时约束正文与目录。切换分类清掉不相容旧章节、保留相容章节，重载一致；历史分类已消失的地址保留分类并提示，主动点“全部内容”后才展示未分类原文。精确ID优先于别名；失效依据的首H1与后续同名标题保留旧地址，重复标题ID不会互相覆盖。侧栏按完整目的地只选一项，目录入口不继承上一页筛选。
- 没有相伴分类徽标的导航、搜索、页面/浏览器标题和关联入口保留作者的`[现状]`/`[拟议变更]`标签；两份同名退款时限可以在选择前区分。作者锚点仅作为净化后仍呈现节点的映射，id/name仍不进入宿主DOM；首H1映射到页标题并保留ID槽。IAB中policy-r17到达R17条款、首H1回到页标题、name锚点展开折叠，作者page-title未替换宿主标题。文末折叠草案仍可从目录打开，但不抢当前可见的夜间门店例外高亮。
- Mermaid内联图、图像名称和放大弹窗复用计算过的章节题名，`Diagram<br>Review`统一为“Diagram Review”，不混入自动#。
- 当前项目文件路径逐段编码后作相对URL基准。#/%/?目录均打开本批次七天而非总部三十天，同页锚点保持原文件。
- 普通来源正文/依据区/弹窗/原文真实href固定单文件摘要；原网页与任务模型固定双摘要版本路径。普通/修饰键/复制新标签都验证；只改HTML或JSON，旧配对地址409，刷新后当前地址200。普通日志换版、BOM+CRLF字节摘要也分别核对，失败不保留成功摘要。
- 每次仍检查路径、可达性与当前文件字节，只限量复用同SHA的不可变标题/链接，热目录/正文/搜索零次解析，改单页一次；并发、删除、撤掉唯一引用/重连及凭据路径阻断有回归。200篇3.29MB的本机HTTP合成输入中，冷200次解析，热目录/正文/搜索中位约0.022/0.021/0.044秒；不含浏览器建索引，不外推真实大项目性能。
- 浏览器搜索同样只复用当前批次校验有效且摘要不变的可见文本和相同集合的索引，每次查询仍请求当前批次。另一份200篇、3,844,904字节合成输入，IAB输入到结果首次683ms、后三次323/318/323ms，含防抖/HTTP/渲染；CDP TaskDuration分别约0.472/0.052/0.032/0.033秒。不是上一会话同一份输入，不作前后加速比或CI门槛。改正文后旧词0项且提示变化，刷新新词1项；删文件前后查询均0项，未改来源仍能找到。
- 默认命令不再强传可选任务目录；只有业务材料也能启动。隐式docs/changes每次重新安全探测，显式--tasks保留原诊断。IAB在同一进程启动后创建目录并新增first.md，刷新即收录；再增second.md和HTML/JSON配对，旧目录的搜索与任务列表明确提示新增来源需刷新，刷新后两份记录与一个原任务均出现，原任务标题搜索1项。当前目录快照不会静默混入未核对元数据，空态也明确属于本次目录读取。
- reader-build已声明现用esbuild0.27.7，独占临时目录离线安装/构建成功，6个vendor摘要一致，不依赖根node_modules。实际独立构建Node26.5；阅读器Node24.18实跑。最低20.19和Windows本轮未实跑。

历史输入、HTTP与原生观察可分别查[首轮修复](peer-review-fixes.md)、[链接阶段附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/peer-review-links-2026-11-27/README.md)、[语义阶段附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/peer-review-semantics-2026-11-27/README.md)、[边界阶段附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/peer-review-boundaries-2026-11-27/README.md)和[可见范围附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/peer-review-visible-2026-11-27/README.md)。它们各自保留当时快照，不替代当前输入。上一轮交接与搜索实测见[附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-handoff-2026-11-27/README.md)；前一轮[UI附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-ui-2026-11-27/README.md)仍为历史输入。

历史后续附件：[来源/标签/锚点](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-entry-2026-11-27/README.md)、[作者地址](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-author-anchors-2026-11-27/README.md)、[范围与批次](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-scope-batch-2026-11-27/README.md)、[摘要配对](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-summary-pairs-2026-11-27/README.md)、[模型探测](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-model-cache-2026-11-27/README.md)、[来源身份](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-source-identity-2026-11-27/README.md)、[配对依据](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-pair-confidence-2026-11-27/README.md)、[生命周期](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-lifecycle-2026-11-27/README.md)。均保留当时输入、观察与回执，不替代当前候选。泛work识别、通用字段单独识别、按500份读取额度淘汰身份、父目录存在即保留身份等旧判断已被后续反例推翻；以当前实现为准。

冷启动、路径复用与路由归属的前一阶段观察见[冷交接附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-cold-handoff-2026-11-27/README.md)。除实际配套图页、图页声明、显式单任务入口和仍可达的已确认身份外，也读取模型已有的精确publication配对声明，以及可达Markdown范围内的有效任务视图与同目录AI引用。显式overview/detail不要求node；省略view时需非空node；空/未知值不作声明。普通工单仅有work/id/title仍可读，不把原文可读当作任务配对成功。模型按已检UTF-8的原bytes解析，BOM计入字节SHA。

真实新服务首次目录即能诊断协议缺图、无声明图页下的截断/缺work模型，图/AI两侧均404；目录先弱扫和纯Markdown、两种链接顺序均核对，普通工单扫描内外200。IAB实际看到具体原因与恢复条件，没有坏模型原文入口；默认view和overview另用两个新HTTP进程复验。已确认身份仅在内存保留，额度不淘汰可达故障；按具体任务文件、显式入口和引用判断退役，不以无关父目录或audit.csv留住旧任务。HTTP实测保留audit.csv的旧任务退役后，同路径普通周排班在同一服务200。500个无声明配对中损坏000并新增健康任务、连续两刷保持拒读的历史输入也有当前回归。

IAB实际从现行七天页进入拟议十四天页，完整打开原文后后退，旧弹窗关闭。受控HTTP代理只暂缓guide原文，返回现行页后才放行旧真实200：弹窗不重开，旧hash/href不恢复，当前页原文可正常打开。更早的刷新时R2先200、R1后409输入保存在生命周期附件，并有当前受控回归。同页section/主题保留以及搜索、任务参数、分类切换另由本轮回归覆盖，不外推为全都另做了IAB操作。

性能与内存结论只限声明输入：50份明确健康任务各读/解析一次；普通50份、8,102,690字节JSON规范化0次且探测仅存纯值。逐篇判定时期曾为避免保存整库原文而重探测弱候选；该补升级路径已随本轮全局收集移除，后页提供依据的空work回归也核了模型单次读取/解析。旧性能观察不是当前全项目基准，也不作为CI时限。

前一轮目录整体一致性见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-catalog-consistency-2026-11-27/README.md)。先收集全部可达Markdown及每条链接的一次规范化结果/错误，再统一判定任务、生成链接/导航/反链；不按文档碰巧的遍历顺序补角色。实际HTTP核了无node的显式任务视图、跨文档的两种引用顺序：坏模型均404、普通同名手册/报价及工单均200，两次目录除read_at外相同。IAB全新服务首次进入work:{}样例时，正文和左导航即为正确任务地址；打开后同时有入口/交接两页反链，不靠刷新。HTML未声明摘要的提示保留，不认证合成页的业务节点。

真实500个缺失链接后追加有效guide，目录仍有两份真实文档、guide导航及200，缺失原因500条、不虚报超限；独立坏任务MD的无入链提示和真实可读文档上限另有当前回归。相同121篇/721链接/24来源的热目录，本机计数link_target从1442降为721、local_path从4112降为2069；不宣称浏览器耗时或全项目速度。每次实际读取的安全路径、当前版本与可达性校验保留。旧原生close晚于弹窗重开的观察只用受控回归补两行守卫，未声称普通IAB已复现该边界。

任务关联与容量原因的前轮输入、HTTP和IAB观察见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-task-context-2026-11-27/README.md)。已确认任务的图页和精确model_path共同建立业务反链、按文档去重；仅模型引用的维修规则可从任务反查，双引交接不重复，JSON点击仍是双摘要原文。普通同名JSON、相邻terms和坏配对不成为健康任务关联。

实际500份可读文档边界下，第501份已读但超限的Markdown、之后尚未检查的目标有各自容量原因，保留在具体链接、catalog.document_errors及原文响应；后续目标不猜缺失。正文、关联依据tooltip和保存的Reader地址均指明缩小入口/任务目录并重启。此前已查明的404/415保留，普通2MiB来源413仍提示缩小内容或外链。根初查保存地址时漏读单独notice区域，随即IAB截图确认原因原本可见；这是核验遗漏，无产品修源。测试页、两服务和临时输入已清理，真实61789预览重启并在原URL加载当前代码。

前轮卡片与容量汇总的输入、HTTP和IAB观察见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-batch-cards-2026-11-27/README.md)。前端只对本批实际核对的对象更新读取状态，先校验异步版本再更新；任务范围批次没有核对到的业务页不误判。已知失效的任务/变更标题在列表与侧栏为带原因和恢复条件的非链接，失效关联和任务AI入口不再可点；共享来源入口也不降级成普通文本。IAB在健康目录后删除模型和关联MD，保留有效业务命中；恢复原字节后新批次重新启用；换成revision2和第二批MD后旧入口禁用，旧配对HTTP409，刷新原文弹窗实际读到revision2。HTML摘要声明不匹配提示保留，不把原文可读算成一致。

后端业务反链仍按文档去重。前端关联按路径、允许的查询和节点去重，HTML入口替代自动模型默认入口，作者标签区分不同目的地；模型在前/后、不同查询等有当前回归。IAB卡片和侧栏均保留accepted/detail、expired/detail、accepted/overview+柜台查询三处，重复accepted仅一处；实际点击后iframe显示相应view/query/node。该HTML是路由探针，不宣称原业务节点验收。

纯容量652份可读MD的HTTP与IAB全局仅1条汇总，152份具体document_errors及413保留，普通混合错误仍分别定位。1600×900实测搜索1项、提示高37.04px、首卡y303.51；任务499卡、提示37.04px、首卡y333.24，无横向溢出。提示给出缩小入口/任务目录并重启，不再一概要求恢复文件；未增加字段、分页或上限。混合404/415/普通内容413由本轮后端回归覆盖，不称另做了根IAB。当前真实61789服务已重启、原用户页重载；本轮测试页/服务/临时目录已清理。

前轮父页隔离、换批与任务容量的输入、HTTP和IAB观察见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-dependent-sources-2026-11-27/README.md)。来源状态在生成正文、依据区、原文和页面入口之前统一核对，失效条目不会再通过sourceUrl异常中断健康父页。IAB从搜索命中进入七天规则页，删除任务模型或普通Markdown后正文和有效rule.txt均可读，右栏坏依据无href；实际打开了有效附件。原字节恢复后新批次重新启用。删除/更新/恢复的模型单链、图页、MD与父页完整调用链由当前回归覆盖，无额外来源请求。

换批没有返回某行时仅表示“本批未读到”，不猜文件删除；只有返回有效SHA确实不同才称更新，明确row.error保持原原因。根又发现更新提示附加了修复合法文件的矛盾指示，已按本批明确状态修正并在最终代码下重新载入基线、换版后实测：模型与MD的tooltip只要求刷新核对新版，七天正文和附件仍在。未使用错误文本前缀判断，不改业务内容schema。

652份可读MD的旧目录打开后，实际新增152份排序靠前的文件；现在共804份，152份旧项本批未读到、152份新增待刷新，顶部只给数量摘要，305条路径/原因在默认闭合原生“读取明细”。1600×900实测搜索1项、提示37.04px、首卡y359.55；任务499卡、152个旧标题禁用、提示37.04px、首卡y389.29。明细实际开合、无横向溢出，padding8/12px、ul16px；刷新后early-000出现、旧禁用数0。具体304个容量目标原因仍在目录，不将未知项称为坏文件。

实际501份健康任务与150篇业务引用只产生一次任务容量汇总。逐链接scope/status413保留；以task_error_statuses纯状态元数据统一两侧双摘要及/content读取，四地址均413。释放一份代理自建任务后，同四个旧地址200。真实缺失、坏配对及普通同名JSON的原语义另由当前75项后端回归覆盖，不外推IAB做过这些对照。三服务、测试标签54–56和临时输入已清理，真实61789服务已重启、原用户页正常重载。

前轮普通来源、批次版本与自动任务容量的输入、HTTP和IAB观察见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-source-checks-2026-11-27/README.md)。批次source_checks只传同一目录扫描已得的普通来源摘要或确切error/status，不传附件正文、不新增扫描；健康/故障任务两成员保留双摘要优先。MD、任务与普通来源共用读取诊断，未检查的来源不凭缺行猜失效，错误行不作为健康新增项或任务卡。

IAB健康目录后删除CSV、TXT、普通model.json，搜索再进办理指引，七天正文和健在附件仍可读，正文/依据三项均无href且明确缺失原因，健在附件实际打开。原字节恢复后新批次重新启用；合法R2后三项只要求刷新核对新版，复制旧CSV/JSON地址409。刷新后普通JSON实际读到fee14，仍是/content单文件摘要，没有被当作任务。

受控时序包装器只在独占样例的目录返回之后、records迭代之前换terms.md和任务model.json，使用原Reader真实HTTP服务并记录实际行、去掉正文；两行均保留status409。IAB搜索进入父页，七天规则和有效附件保留，MD/模型提示仅刷新核对新版，不要求修复合法文件。此为明确注入的时序，不宣称自然操作随机复现；其他状态转移另由当前回归覆盖。

对仍在本次扫描范围、先前确认过、因额度未probe的任务只stat配对文件，不越额度读正文；已知容量/缺侧故障沿既有task-page错误行传入热批次，逐项scope/status保留，未知同名或范围外不伪造。实际500份自动任务无业务入链，最后一份AI弹窗先读revision1；加更早任务后，旧目录热搜索/列表与侧栏说明容量及两种缩小范围途径、无旧AI入口，四个保存地址200→413。物理移除该任务后同四地址404。另以501份全由MD链接、显式空任务目录的输入，单改窄业务入口即可使同四地址413→200。五个测试服务、标签57–59和临时目录已清理，真实61789重启并在原用户页加载当前候选。

拒读目标、MD错误和缺件优先级的输入、HTTP和IAB观察见[前轮附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-rejected-state-2026-11-27/README.md)。词法URL定位与实际文件守卫分开：已确定项目内目标保留类型/片段，真正text_file/stat仍完整local_path校验，不把解析成功当可读。IAB在旧目录把普通sign.txt替成同项目符号链接，搜索进入父页后正文/依据无href且精确说明拒读，正常ok.txt实际打开；刷新后仍是同一精确原因。HTTP403保持。编码路径/片段、MD符号链接及禁止alias/目标read_bytes另由当前回归覆盖，不宣称根浏览器逐项实跑。

all/tasks沿records带本次catalog确知document_errors的纯错误/status/scope；tasks限制正文，不否认目录扫描已确知的业务MD错误。该阶段客户端对已有文档更新额外明确错误，不凭缺行推失败、不扩正文卡；下述后续修复补上同一tasks范围的成功摘要恢复。IAB删除一份task MD和一份被task记录引用的business MD，先读任务列表：坏业务关联撤下、task标题精确404且没有business正文卡；搜索进入父页，两个引用均精确缺失原因、七天正文仍在。原字节恢复后一次all批次恢复链接；随后损坏两份UTF-8，两种scope纯错误行均415，任务卡和父页都准确显示编码原因。

652份MD中加入更早一项，已在旧目录中的record-498在all/tasks行均为413/scope，IAB仍有一个有效搜索结果，任务卡用容量及缩小范围/重启条件禁用该项，不再降为未核对。当前范围外或已不可达目标不伪造错误；未请求正文不导致误判。

配对容量登记与正面任务链接复用实际两文件存在检查，缺件404优先、完整才413，未知普通来源不走配对推断、不越额度读正文。两份独立HTTP输入分别为目录+显式单图、空任务目录下纯MD引入：各自先暖态四个保存地址200，加入/展开到501份后413，再仅移除被挤出model.json后同四地址404，均明确指出缺失模型路径、无额度原因。此为实际HTTP矩阵，不称额外根IAB任务流程。五个服务、测试页60–62及临时目录已清理，真实61789已重启，原用户页正常加载当前代码。

task-only恢复的输入、HTTP和IAB观察见[前轮附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-task-recovery-2026-11-28/README.md)。根只读补查发现：tasks此前传已知业务MD错误，却不传成功摘要，原字节恢复后旧404会保留；两方代码审查独立确认，未把142项通过当此路径已验。现在沿既有records传同次目录已核得的非task path/SHA，不传正文、不增加读取；该阶段已有文档同SHA清错、异SHA提示更新，无行保留旧状态；下述后续审核修正完整枚举下的缺行处理。requested正文还须text为string，metadata-only不得计成功或进入索引，空字符串正文仍合法。

实际IAB保留同一个旧目录，仅反复从业务入口进入任务列表：删除业务MD撤下关联，恢复原字节后tasks批次自动恢复关联，点入读到七天原文；合法R2后再进tasks，旧关联撤下，入口tooltip只要求刷新核对新版，旧SHA原文HTTP409。期间没有all/search批次或目录刷新。82项后端另确认无额外读取；同SHA/异SHA/缺行及正文guard有先红后绿回归。首次宽测发现模拟刷新夹具共享对象污染及两处lint括号问题，已修正并以144项正式回执重跑，不将首次失败当通过。临时项目、49164服务及tab63已清理；真实61789用当前候选重启，在用户原URL读到项目原文且830/830无横向溢出，保留预览。

可达业务依据的输入、修前/修后HTTP和IAB观察见[前轮附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-reachable-context-2026-11-28/README.md)。独立审核指出新tasks协议既已完整枚举本次可达业务MD，旧目录文档缺行便应通过现有readCheck(undefined)标为“本批未核对”；保留旧健康状态会误推已退出本次业务目录的反链。执行方认同，同一IAB/HTTP输入先复现旧任务卡仍推荐、保存地址404，再最小修复为全部未请求旧MD消费本次行或缺行；不声称文件已删除、不扩正文或增加读取/状态字段。

根IAB保留旧目录，index→terms→change，另有健在valid→change，task可独立发现。仅撤index到terms的唯一链接，terms/change字节保留：仅重进tasks后旧反链撤下，valid反链实际打开原凭证正文，业务导航terms无href且精确提示尚未核对。恢复原index引用后再仅tasks，反链和业务导航恢复，实际点入读到七天依据；期间无all/search或目录刷新。145项正式回执及140项Reader验证覆盖状态与恢复，82项后端输入未改。测试项目、58415服务和tab64已清理，真实61789在原URL重载当前JS并保留，未改真实陈列材料。当前与审核方无实证分歧。

导航声明与目标原文的输入、HTTP和IAB观察见[前轮附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-navigation-state-2026-11-28/README.md)。导航的label/章节/查询来自业务入口，是独立于目标文件可读性的声明；只验证目标SHA不能证明旧入口仍适用。批次沿既有catalog返回同次navigation，不增加读取；前端仅在renderVersion守卫后记录在当前catalog。渲染用path/label/fragment/query建一次Set比对旧声明，撤下变化项，保留不变邻项；不永久改原导航数组、不把目标doc/page全局标为坏文件。恢复原声明可再现，刷新采用当前声明，复杂度为两份导航线性遍历。

根IAB旧目录中entry列fast办理/任务节点与hub；hub仍独立链接通用规程和原任务。仅换entry为核验/check，再tasks后两旧fast入口撤下，hub仍可点，entry沿原机制提示更新。泛入口实际打开通用规程，fast/check两分支均可读；恢复原entry再tasks，四项原声明恢复。再换R2并刷新，新导航实际进入terms的section=check、iframe真实body为view=detail; #node=check。HTML是隔离路由探针，未声明模型摘要的警告保留；不宣称真实业务节点或图/模型发布一致性通过。单独label/fragment/query与两scope、迟到批次由先红后绿回归覆盖，实际根UI同时改变标签和目的地。测试服务55688、tab65与临时输入已清理；真实61789以新backend重启、原URL重载当前JS并保留，真实项目无写入。当前双方无实证分歧。

前轮已知读取结果同步的输入、HTTP、各候选实际IAB与清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-read-failures-2026-11-28/README.md)。入口声明与目标健康分开：保留作者仍声明的本地MD/已确认任务条目；本批entry在catalog后读取409/404，仅清该批独立nav副本，不改catalog快照或额外读取。正常扫描/读取新版时保留共有邻项。单页和原文读取保HTTP状态，沿共享readCheck/apply回写具体metadata；entry失败撤销它的导航可信度，普通规程失败使反链失效，独立目标仍可读。未知传输状态只标未核对，本地已知阻断不重记成新HTTP。

单读绑定catalog、metadata身份、readVersion及页面/弹窗owner；发起读取和任何apply推进代际，helper的成功/失败经多层Promise到页面/弹窗展示前再次核对。受控测试先复现helper已应用旧错、外层catch前新batch成功仍被旧错覆盖，再修为旧错不showReadFailure、旧文本/摘要/href不回填。保留普通body空字符串语义，不新增网络请求或把未读状态计成功。

根3bed候选IAB66–69实际覆盖：单页和查看Markdown的entry409均撤旧导航；普通rules409后不经tasks/search直接进入handoff，依据区只保留健康hub；独占wrapper在真实catalog之后、records之前换entry，all响应真实409/nav[]，健康搜索命中与父页仍可读；入口未改而terms/model缺失，热侧栏保留两项非href及具体路径/恢复条件。原引用/字节恢复后的batch和刷新恢复也实跑。后续805只增加精准scope与中性空态，单独实际501任务quota413和普通2097153字节size413对照；不伪称这些都是同一SHA的一轮浏览器运行。

容量scope只来自实际额度注册，沿ReaderError、HTTP、links/batch及catalog.task_scope_limited传递；不从413或文字推断。普通2MiB没有scope标记，缺件404清除旧额度语义。86项后端含真实HTTP的MDquota、任务两成员/两路由、普通与catalog后任务超大、缺侧优先等对照；根实际UI另分别核对quota要求缩小业务入口/任务目录并重启，size要求缩小内容或外链。

根805实际又发现弹窗已失败而父正文旧href未同步，已补共享失效链接转换：内部目标在首次instrument/nav/card时登记；仅更新当前已呈现且已知坏的链接，不反解改写URL、不新增读取。保留内联br/em及作者锚、tooltip，健康parent的context复用原doc/toc并保展开。最终b514在同一初始输入重新实际501+普通size对照：HTML/model与附件正文、侧栏、依据区均非href且原因一致，展开状态与父标题保留，唯一健康邻项实际打开。再改entry查看原文409，空态准确为“暂无已核对的文档入口”。三份早期项目、最后quota、4端口/5标签、wrapper及生成的501对均清理；真实61789新backend/最终JS在原URL重载，2186字正文与830/830宽度正常，真实陈列未写入。

前端独立宽测有一次默认加载器启动未见RUN，代理采样为Node空闲，结束自有父子进程exit143；没有任何测试开始，不计通过，也未证明根因。随后用正式固定runner/maxWorkers1独立五文件189项通过。该轮正式六文件194回执继续沿原command/roots/超时，typecheck、10文件lint和附加ESM22均退出0；没有放宽测试或修改配置。当前与审核方无实证分歧。

前轮目录建立失败与冷导航恢复的输入、HTTP、33669f2e候选IAB和清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-catalog-errors-2026-11-28/README.md)。仅catalog建立失败携带结构化error_stage及实际error_source；普通目标自身404/409保持原语义，没有伪造来源。共享前端处理将依赖旧目录的元数据标为尚未核对，撤旧导航与关联；健康票据或配对模型不被误报成缺失/损坏。成功的新批次或刷新能解除目录失信；读取发起时捕获代际，双向阻止迟到旧成功/失败覆盖较新结果。这些时序由受控回归证明，不冒充自然浏览器网络时序。

根实际HTTP覆盖catalog、all/tasks、普通票据和双摘要模型五条路由，入口缺失404与非UTF8 415均点名真实入口；恢复同字节后目标200，普通目标自身缺失404/换版409对照无catalog标记。IAB71–74分别从健康页触发普通/配对/all/tasks失败，旧导航全部撤下，保留正文明确标为未核对；同版入口恢复后实际打开原凭证与revision1双摘要模型。新版入口恢复先经all批次，旧fast没有复活、共有邻项可用，刷新后实际进入check章节。未写真实陈列或额外扩大目录读取。

冷导航只用本次明确navigation和document_errors/task_errors构造渲染用禁用项，不向docs/taskPages添加虚假内容，不纳入普通来源或外部链接。IAB75–76实测同一五项声明，热目录、刷新、新窗口都保留两项具体故障路径及恢复条件；作者确实撤两条后才变三项，修复来源并恢复声明后五项全可用。三个服务、六个临时标签与测试根已清理，真实61789仅保留只读预览，原用户URL重载后2186字正文、830/830无横向溢出。

该轮214项正式回执沿用原command/roots/超时，前后输入指纹b58a7eb3…75c8c8一致；typecheck、10文件lint及额外ESM doctor22均通过。独立check当前succeeded/current、前194项succeeded/stale，失败和历史回执未改。没有为这些Reader缺陷修改核心流程；该轮两项原输入随后独立复核关闭，新增问题按下述最新输入继续修复。

前轮首次画布错误、冷诊断与失败指引的输入、原始反例、HTTP、各SHA的IAB及清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-frame-status-2026-11-28/README.md)。双摘要handbook的embed错误保留真实HTTP状态，仅以原受限CSP的HTML显示安全原因并通知父页；非embed/AI原文保持JSON，正常HTML与相对模型地址不变。消息只作通知，不采信其错误payload；严格匹配当前iframe、nonce、路径/双SHA、目录/路由/读代际，每帧只处理一次，再用现有readSource实际复核同一非embed双摘要地址。真实HTTP决定目录或配对诊断；复核已200也清空未加载画布及原始操作，提示刷新重开。没有preflight或每次正常画布的额外读取，没有签名设施或sandbox放宽。

根用冻结33669f2e旧快照实际IAB77复现：只删entry再单击快速审批，iframe是catalog404 JSON而外层仍1个任务链接、2个原始操作及已保存网页提示。8614候选IAB78同一单击变父页尚未核对，iframe、原始操作及目录链接全撤；IAB79仅改model revision后单击即配对409、无须再点AI，普通入口和健康票据仍可实际打开。普通局部失败仍可建议切文档，目录失败的搜索和tasks只指向恢复目录后刷新。刷新配对后真实iframe显示view=detail/node=fast；恢复entry为R2后只有人工声明，实际点到manual.check。HTML是路由探针，不是业务节点验收。

冷错误按路径取本次已核对诊断；有效但未纳入旧目录的来源保留禁用，明确已读到、刷新后纳入，不创建docs/taskPages。8614 IAB80已核菜单/正文/依据从缺失变编码/JSON错误、再变待刷新；根另发现context折叠警告仍读初次catalog，已用同guard后的既有batch warnings副本替换，含[]清旧提示，原catalog警告不改、无新请求。最终3f44重载该冷样例完整复验：三处与展开警告都显示新UTF8/JSON原因；恢复后两次搜索，旧缺失和来源警告消失、待刷新口径一致；显式刷新实际读到七天规则。最终小改只消费warnings，首次frame行为另有235项最终源码回归，不伪称根全部浏览器步骤发生于同一SHA。

该轮240项正式回执沿用原command/roots/超时，前后指纹00e9abab…c41411一致；typecheck、10文件lint和附加ESM doctor22均0。root独立check新succeeded/current、214项succeeded/stale，历史原始回执不改。三个测试服务、四个标签和独占临时根已清理；真实61789重启为最新backend/JS并在原用户URL实载2186字、830/830无横向溢出。未改真实陈列材料，当前与审核方无实证分歧；最新修源后的完整独立审核仍待返回。

前轮存续画布与AI并发的输入、受控包装器、实际HTTP顺序、IAB及清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-frame-concurrency-2026-11-28/README.md)。画布身份仍绑定frame对象/nonce/任务双SHA/路由/render/catalog对象，不把同页AI发起造成的共享计数变化当作frame已替换。故障复核只允许越过较新但尚未接受的请求；已接受的新AI或批次事实仍压过旧复核。普通原文请求守卫不放宽。弹窗取消没有接受事实，不能吞掉存续frame的真实catalog404/配对409；较新AI200已接受时旧错不回写，但仍独立清未加载frame和原网页/AI操作，中性提示刷新重开，不声称画布成功或臆测来源恢复。

最终7844候选root IAB81：首frame挂起，实际看AI revision1/字节摘要/双SHA原文200后关弹窗，删entry放首HTML真实404；父确有第二次非embed复核404，导航/原始操作0、frame移除并指向entry故障。IAB82：首HTML实际409，父复核已开始并挂起；恢复model R1、AI实际200后关，放复核200，frame/操作清空但已接受的模型text/hash/双SHA链接仍保留，只提示首次画布未加载。IAB83：首catalog404、复核挂起，再开AI pending并Escape，放两响应均真实404，父全目录unchecked且导航/原始操作0。包装器只延迟生产task_page_content调用/响应，不注入错误或替换父JS；这是明确受控时序，不称自然概率或性能结果。

三条路径刷新后都实际加载原frame，服务各第3次HTML真实200；两目录按R2只声明人工核对/hub恢复，业务侧栏无旧fast，实际点入manual.check。原任务仍可独立从任务目录访问，不把撤业务快捷等同删任务。三个服务/标签81–83及独占temp已清理。真实61789后端未再变，最终JS在原用户URL重载，2186字正文、830/830无横向溢出，真实材料未写入。

六项同页并发回归实际先红后绿，另两项取消catalog404/旧catalog错迟到对照在修后通过，不包装为单独先红。该轮五Reader243项、正式六文件248项和typecheck/10文件lint、附加ESM doctor22均通过；前后指纹8b2afdee…922ba72一致。root独立check新succeeded/current、240旧回执stale，历史原始回执不改。没有新增正常画布预检、无限重试或核心编排；当前与审核方无实证分歧，最新候选仍待完整独立审核。

前轮请求顺序与开放原文的输入、受控包装器、真实HTTP及各SHA的IAB见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-read-order-2026-11-28/README.md)。接受frame结果沿用请求自身的顺序，不从到达时的当前计数递增；后发AI结果仍可更新自己的弹窗与配对范围。若先前有目录故障，后发单读200只重新核对该目标，保目录readFailure、旧声明不启用及其它来源未核对；取消/换页/换catalog保护保留。已显示原文的开放弹窗被真正较新故障影响时清正文/摘要/href并关闭；尚在等更晚请求的弹窗不被旧错关闭或换owner。

root d04 IAB84：首frame与父复核真实409，复核响应暂缓；恢复R1后发AI，真实revision1/200已产生也暂缓。先送旧409，modal仍等待；再送较新200，实际显示原文、字节摘要与双SHA原文链接。IAB85/86各先实际AI200并保持弹窗开，后只改model或删除entry，frame和父复核分别409/catalog404；modal随接受的故障关闭且正文/摘要/href清空，父分别只禁pair或全目录未核对。包装器仅延迟生产调用/响应，日志明确区分captured/delivered，不造返回状态。

root又发现d04在成功AI200关弹窗后，背景仍留旧409原因；已仅在实际200清配对旧错、画布已收起且无有效目录故障时改为“当前画布未能加载；原任务来源已重新核对。请刷新内容后重开原任务。”最终a5ee IAB87从同一R1重跑完整旧409先/新200后序列，modal仍正确呈现，关闭后新说明准确、frame/原始操作仍0，刷新实际加载HTML3/200及view=detail/node=fast。最终小改只调整此copy，开放modal两scope的根实测在d04，当前完整回归覆盖最终代码，不把各SHA混为同一次浏览器运行。

六项本轮原缺陷回归实际先红后绿，closed-modal及两scope较新批次恢复等相邻控制在修后通过；新增背景copy在旧copy上也实际先红。该轮五Reader252、正式六文件257、typecheck/10文件lint及额外ESM doctor22通过；前后指纹ea04f97b…9d49ece相同。root独立check新succeeded/current、248项stale；历史回执不改。四个测试服务/标签84–87、独占root及gate已清理；真实61789原URL重载最终JS、2186字且830/830无横向溢出，真实材料未写入。当前与审核方无实证分歧，最新候选仍待完整独立审核。

目录与单来源的核对范围输入、实际换序、HTTP路由计数、IAB和清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-catalog-scope-2026-11-28/README.md)。目录接受顺序独立于单来源接受顺序：A的新200只保护A的原文及配对，不代替旧导航/邻项的目录核对。当前frame/单读及批量的catalog错误都按目录范围处理，不因其它单源发起/成功就丢弃；较新完整批次或刷新仍能压过旧目录错，普通成功批次正文/索引写回保原新鲜度守卫。已有逐metadata较新事实继续保护A，旧声明撤回、B尚未核对。A已有实际200时，页头/正文/notice共用画布未加载收尾，明确原任务来源已核对、其余目录待刷新，不再把旧entry缺失当A当前状态。

最终4bb0 root IAB88/89两项目从同一R1出发：入口原声明直接通过→rules.fast、稳定hub与A，A/B配对均健康，先把hub加入真实浏览历史。挂起A首HTML，移entry使frame/父复核都真实生成带catalog/index来源的404；仅复核响应暂缓。以R2恢复入口只声明人工审批→rules.manual/hub，并删B模型，A/rules/hub字节不变；后发A模型实际200/revision1。88先送200再旧404，89反序，两边都实际保有效模型正文/摘要/双SHA原文，任务nav仅Ahref、B为未核对；关modal后页头/正文/notice一致A已核对/画布未加载/其余目录待刷新。两次真实browser back回原hub，业务侧栏没有旧直接通过；HTTP日志各仅一次/api/catalog且无document-texts，未靠暗中整批/刷新关闭反例。

随后两项目实际all搜索，hub命中1并恢复可用，旧fast不再推荐，B缺失由这次完整读取明确得知；显式刷新后采用人工退还导览/人工审批/hub三项R2声明，实际点到rules.manual正文“转人工审批”。底层通用规则页仍保原作者fast段落，不把入口撤下误当删原文。两个受控服务只加gate/路由日志，不造状态或改父JS；退出/清理测试标签88–89、服务与独占root后，真实61789原URL载最终JS正常，2186字且830/830无横向溢出，真实材料未写入。

两顺序原例与bulk两scope同根回归实际先红后绿，较新完整批次前/后送达等控制在修后通过。records夹具四处共享常量改为拷贝，消除proof字段跨测试污染，未削弱断言。最终五Reader258、正式六文件263、typecheck/10文件lint及额外ESM doctor22均通过；前后指纹f3fa5246…ae5789b一致。root独立check新succeeded/current、257旧回执stale，历史原始回执不改。未新增正常路径请求或核心步骤，当前与审核方无实证分歧；最新候选仍待完整独立审核。

目录复核与画布生命周期的前轮输入、HTTP及IAB换序、清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-directory-owner-2026-11-28/README.md)。已认证的在途画布复核，在目录级错误分支按当前目录、render和任务元数据身份接受，不以iframe是否仍挂载判断目录结果。普通局部结果与画布收尾仍保留DOM/路由保护；A较新的精确409/404继续优先，先发目录404只撤其覆盖的旧导航和尚未核对的邻项。真正换路由、刷新或新完整批次仍隔离迟到结果。

根四组全新IAB从稳定票据台进入A，在首HTML读取前移除业务入口，使iframe与父页复核实际取得catalog404；暂缓父复核响应，按R2恢复入口并删除B模型，A分别合法换版409或删除模型404。较新AI响应与先发目录404两种送达顺序均实际验证：画布及原始操作移除、B无href、A准确原因保留且说明其余目录待刷新。真实返回票据台，旧fast不能继续推荐；四组此时catalog均仅首次一次、无document-texts，不靠暗中整批更新。随后实际搜索“收件”各1个健康命中，主动刷新各三条R2导航，实际点击manual显示“转人工审批。”。探针HTML未声明模型摘要的原提示保留，不宣称业务节点或配对声明一致性验收。

两项新失败顺序测试实际先红后绿，其余四项A=200及反向顺序控制修后通过；不是六次根IAB。正式六文件267项、typecheck、10文件lint与额外ESM doctor22通过；采集前后输入指纹70e4912b…44fa617相同，root独立check新succeeded/current、263项succeeded/stale。四个测试服务、标签90–93及独占临时根已清理；61789原用户页重载b77ab626最终JS，正文innerText2129字、830/830无横向溢出且无故障提示，真实项目只读。未新增正常路径请求或核心步骤；完整独立审核待返回，尚不作为整体审核通过。

来源弹窗与目录生命周期的前轮输入、HTTP、IAB与清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-source-owner-2026-11-28/README.md)。openSource捕获当前catalog/render/路由作为目录归属，Markdown和普通来源共用；modal/sourceVersion仍只取消弹窗写回。旧目录错误不能因关闭或替换弹窗被吞掉，也不能取消较新有效回单；若当前任务确已未核对，统一故障页清除已加载画布及原始操作，较新健康A事实继续受保护。

根四组实际IAB：CSV关窗后不重开、CSV关窗后较新ticket200仍开窗、当前MD关窗、已成功画布AI关窗。各自正式读取在index移除时取得catalog404后暂缓，关窗后恢复R2/删除B模型再送达；四组旧导航无href，AI组原画布及原网页/AI入口也撤下。较新ticket实际正文、完整字节摘要及单摘要原文链接仍在。四组恢复前catalog各一次、无document-texts；主动刷新后实际到manual并看到“转人工审批。”。六个三类入口的原触发实际先红后绿，其余scope控制直接绿，不冒充六次根IAB；旧VM夹具缺renderVersion的业务前失败单列，补真实初值未改断言。

正式六文件277项、typecheck、10文件lint及额外ESM doctor22通过，前后输入指纹8d013182…1dbeeb5一致。根独立check新succeeded/current、267项旧回执succeeded/stale。四个服务、标签94–97及owned临时根均清理；61789原用户页实载ed63a890，2129字innerText、830/830且无故障提示，真实项目未写。核心/Ponytail不变，无正常路径预检或新流程；最新完整独立审核待返回。

读页生命周期、局部事实与本页说明的前轮输入、真实HTTP/IAB及清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-read-lifecycle-2026-11-28/README.md)。catalog与语义读页epoch控制核对事实，render/DOM/modal代际只控制对应呈现；theme/同hash不等于离开，真实route切换及leaveback仍隔离旧结果。目录与单来源接受序分别保护较新事实，局部404/409不因关窗丢失，也不扩大到健康B/回单。背景按最新本页check与其余目录待核对分别派生，目录错误本身不夹带本页未核对结论；微任务重取latest修复已复现的更晚完整核验守卫，不外推所有UI更新为事务化。

根在8f56字节实测六组：同URL主题重绘后目录404仍撤旧导航；CSV局部404关窗后无关ticket200保留，正文/依据两处费用无href且给精确路径和恢复条件，R1业务导航仍在；已正常A画布的AI409关窗后撤A画布/原始操作，B实点HTTP200；较新本页MD200与旧目录404保留正文、完整摘要和原文链接，背景明确本页已核对；较新MD409先到再目录404，保留具体换版原因而不建议空左栏；旧父画布目录proof在同URL主题新iframe200后返回仍撤失信导航。各组恢复前catalog各一次、无document-texts，恢复实际核了manual、CSV200及A revision1。13项新增的关键原例旧源实红，scope控制直接绿，缺VM实际字段的业务前失败不计产品红。

根收尾另在IAB104确认8f56在本页已核对/目录待核对后，再theme会丢背景说明，导航仍禁用。该真实红例与完整213文件保留在附件validated-8f56-role及manifest。最终1015e33a只在成功render仍属当前且目录pending时复用既有状态呈现，MD/A两条回归先红后绿；根IAB105同一真实顺序实绿，切主题前后均保留本页已核对/其余目录待刷新，刷新实际到manual，不增正常请求。

最终五Reader287、正式六文件292、typecheck/10文件lint及额外ESM doctor22通过，采集前后输入指纹f62a6f09…0e0514b一致；根独立check新succeeded/current、290旧回执stale，旧277及其它输入不冒充当前。六组及红绿复查的所有owned服务、标签98–105和两临时根清理；61789原用户页实载最终1015e33a，2129字innerText、830/830且无故障提示，真实陈列只读。核心604ea706与官方Ponytail不变，无新核心步骤；完整独立审核待返回。

已接受事实、链接双向恢复与在途弹窗的上一轮输入、真实HTTP、IAB和清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-pending-proof-2026-11-28/README.md)。发起同源新请求不再注销旧事实，只按scope/已接受顺序处理；不再保留frame的专项pending例外。所有受控正文/卡片入口包括初始typed span都能按latest恢复或更新具体原因，保净化inline和用途、版本URL及作者锚双向映射；未知/cold及已撤业务入口不复活。依据只在父Markdown已核时重建，leaf成功不替父材料确认。pending来源换section/node失去owner时同步关闭清空，已完成同源原文继续沿用既有约定。

根先在1015/IAB106实证旧CSV404被同源新pending吞掉，实际第二请求尚在正式读取前；该红例与之前215文件冻结输入保留。三项先在唯一隔离副本验证，再一次导入共享三文件，patch/基线/候选摘要已移交；副本随后清理，未同时改动在审输入。旧7处人为更晚核验夹具改为明确共用已接受的global proof order，业务断言保留，不用issued请求伪造完成。

最终a9f99字节下五组根IAB实际通过：CSV404送达而第二请求仍pending时正文/依据禁用，取消等待仍保故障，实际第二200后恢复单摘要href及strong/code，第三次实点读CSV；正常A的AI409同序撤frame/actions且保B，实际新200后明确来源已核对而旧画布未加载，刷新实载；新A实际200先接受再旧409时保frame/操作/完整原文；任务卡先目录404禁用后A模型200恢复标题/AI，B仍未知，两个恢复入口分别实点revision1及A画布200；MD Signed的回执200未送达时Back到Order，弹窗关闭清空，迟到不重开，新开能读文字和64位摘要。任务节点pending、较新404/409更新reason、冷未知等由回归覆盖，不冒充本轮另做根IAB。

该轮正式六文件302、typecheck/10文件lint及附加ESM doctor22通过，前后指纹9baa8cf3…5969640一致；根独立check新succeeded/current、292旧回执stale。所有owned测试服务、标签106–111、root与隔离临时目录已清理；正式61789原用户页实载a9f99，2129字innerText、830/830且无故障提示，真实陈列只读。核心604ea706和官方Ponytail未改，没有新增正常请求/核心步骤；当前完整独立审核待返回。

禁用链接业务说明的上一轮输入、真实IAB观察与清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-link-description-2026-11-28/README.md)。首次禁用和后续span更新共用原作者title与最新失败/恢复原因生成提示，原生title与CSS悬停/键盘提示一致；恢复链接只还原原话，无作者说明时原因只出现一次。没有新增依赖、请求、业务内容或核心步骤。

根用正式Reader独占项目实点带“三十天”合同例外的CSV，删除后真实404，关闭弹窗再分别鼠标悬停和Shift+Tab聚焦，完整业务例外/具体缺失/恢复条件均保留；再让另一附件404触发持续更新，实际重复悬停和聚焦仍一致。恢复原字节并显式刷新后title只有作者原话，实点读到store/15及完整字节摘要。该恢复观察包含刷新，不冒充无刷新恢复的IAB实测。带作者说明的新回归在原源上先红；空说明及404→409→200对照通过。修后五Reader299项、正式六文件304项、typecheck/10文件lint及附加ESM doctor22通过。根独立核验新回执current、302旧回执stale，历史回执不改。

本轮owned临时项目、59191服务与标签112均清理；额外ESM目录也已核验不存在。61789原用户标签10实载最终9b6084cf，2129字innerText、830/830且无故障提示，真实陈列只读。核心604ea706、后端cbeefc57与官方Ponytail未改；当前完整独立审核待返回。

目录已核实错误的上一轮输入、根红绿IAB、恢复与清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-known-errors-2026-11-28/README.md)。链接绑定保留同一catalog对目标已知的结构化失败，仅在缺少更新事实时兜底；最新核对错误和成功metadata仍优先，真正未知继续待核对。没有新增请求或核心规则。

根以219冻结Reader实证：初始CSV/MD缺失、原任务缺model、2MiB+1报价均有具体原因，只删另一ticket实点404后五正文提示退成unknown，右栏仍具体。最终5f052c6a、同一初态和同一操作下五条title/data-reason完全不变，六处正文/依据原因一致，健康附件实际打开及核对完整摘要。补齐文件、缩小报价并补正确配对后显式刷新，七链接恢复，实际打开CSV、双摘要revision1模型、缩小报价、七天规则与原节点画布；作者title只保留原话。该恢复包含刷新；真unknown和较新409/200优先由回归覆盖，不冒充另做根IAB。图页是路由样例，不认证真实业务通过。

四类新冷目录原反例先红后绿，最新409/200和真unknown对照通过；正式六文件309、typecheck/10文件lint及附加ESM doctor22通过。根独立核验新回执current、304旧回执stale，历史不改。旧/新服务55097/58234、标签113/114和owned临时根已清理；额外ESM目录核验不存在。61789用户标签10实载最终5f052c6a、2129字、830/830且无故障提示，真实陈列只读；核心604ea706、后端cbeefc57及Ponytail未变。本轮完整独立审核待返回。

容量恢复文案的上一轮输入、真实501份复验与清理见[历史附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-recovery-copy-2026-11-28/README.md)。只改两处前端提示、两处后端汇总与现有文字断言，读取/限额逻辑和普通2MiB提示不变，无新增测试。根IAB115真实501份可读Markdown加未检查缺失链接，初次500收录、两个尾项均给新提示；只收窄同一index并点击刷新，进程/project/entry/tasks不变，有效规则恢复且实际打开，缺失目标准确404。目录汇总新措辞也通过真实HTTP核对。501原任务场景由回归及上一轮审核观察覆盖，不冒充根再做IAB。

最终JS ee56c67b、后端135b19d9；正式六文件309、typecheck/10文件lint及附加ESM doctor22通过，根独立check新current、known-errors旧309为stale，历史回执不改。51948服务、标签115和owned临时根已清理，额外ESM目录不存在；初次归档stdin编码失败未执行文件操作，ASCII重跑后归档清理成功。正式61789原owned服务已按原参数重启最终后端，用户标签10实载2129字、830/830且无故障提示，真实陈列只读。核心604ea706和Ponytail不变；本轮完整独立审核待返回。

任务配对具体错误状态的当前输入、根HTTP/IAB和清理见[当前附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/reader-pair-errors-2026-11-28/README.md)。任务错误记录沿用ReaderError.status，未分类才404；scope_limited与文件体积413保持独立。修正旧固定404断言，新增一项集中真实HTTP回归，读取逻辑和前端不改。

根用223冻结后端先红：健康、模型超限、HTML超限、无效JSON、模型非UTF8、缺模型、缺HTML、同字节恢复共8状态，比较目录两link/两statusmap、all批次任务行、两双SHA和两/content，共72项；四种格式/大小故障混入404，健康和缺失正确。最终773b同fixture同脚本72项全一致、非容量故障无scope_limited；tasks批次及HTML非UTF8另由新增正式Python测试覆盖，不冒充根all矩阵。根IAB116保存任务地址在模型超限时撤画布/原操作、路径精确且仅建议缩小或外链，原字节恢复后刷新实载原双SHA画布。

正式六文件309、typecheck/10文件lint、附加ESM doctor22通过，根独立check新current、recovery-copy旧309为stale。60346/62252服务、标签116、owned root及ESM目录均清理，矩阵脚本已归档；初次启动路径笔误退出2未起服务，不计产品红。61789按原参数重启最终773b后端，用户10实载2129字、830/830且无故障提示；真实陈列只读。前端ee56c67b、核心604ea706与Ponytail不变；本轮完整独立审核已通过。审核方另核了all/tasks批次、八类文件故障与恢复、真实500任务边界的容量/缺件/大文件区分、健康邻项及普通同名材料，未发现其它需修项，完整范围见最新附件。

## 核心职责

核心SKILL摘要仍为 `604ea706…bd2f`，没有为Reader修复增加模型必经步骤、固定文档或宿主编排。官方Ponytail负责工程取向；RF保留业务闭环、现行/拟议/实测的区分、交接与验证依据，普通局部工作直接调查和验证。文件路径过滤只拒绝已识别的凭据材料，已收录文本由提供方脱敏，不声称扫描文本能保证无凭据。

三份附页首句已对齐核心的具体读取条件：编写持久业务导览、写回接班信息、采证或检查旧回执；没有新增步骤。这三句调整未另跑原生模型样例，后文两例仍按各自包内输入认定。

## 模型行为与未验证范围

新增入口已做一次原生单装盲测：实际 `gpt-6.2-sol`、medium，隔离环境只启用项目候选 RF，无全局 AGENTS、相邻技能、插件或 hook。自然提示只要求接手判断交付并完成本地工作，未点名技能或缺陷；模型首个命令自动读取该轮候选 SKILL，摘要 `8710746c…cfb97`。该例在后来补充技术恢复/业务决定区分之前运行，不直接证明最新入口。

它自主复现“新建正常、重开缺 pickup_code”的接口/存储回读缺口，识别原两项测试没有覆盖该结果，修复并补成 7 项测试；还核对保存失败保原数据、重试及并发路径。独立重放退出 0。实际附页读取为 work.md、verification.md 各一次，business.md、reader.md 均未读。

这次没有明确将未定义的失败/超时恢复口径列成缺失业务决策，需求文档也未改，因此只证明本例主动发现字段回读缺陷并扩展恢复验证，不证明全面识别需求漏项。模型最终表述为“R1 本地功能可以交付，门店实装验收仍待完成”，不能扩展为真实门店或跨平台实装通过。本例没有 Ponytail；旧五例的 Ponytail full 原生注入与本例分别保留。

自然提示、初末快照、原生动作/输出、模型可见隔离信息、模型最终回复及独立重放见[盲测正式附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/blind-autonomous-2026-11-27/README.md)。证据包 SHA-256：`ab416348b6ff0a667de1aae34ae8fdfd2dd2ea8f978c69f6cd4dbf90dcc3dbeb`。临时认证链接、隔离 home、项目和原生进程均已清理，未改真实用户配置或 hook 信任。只有一项合成任务、一次模型运行，无未启用 RF 的对照，不作因果或跨项目泛化结论。

随后锁定当前入口 `604ea706…bd2f`，以不同的设备借用撤销样例只运行一次 `gpt-6.2-sol`。隔离仍只启用 RF，无 AGENTS、相邻技能、Ponytail 或 hook；自然提示未点名技能或缺陷，首命令自动读取 RF。模型区分了 202 请求受理与撤销完成，修正本地状态提示并通过 4 项测试及独立重放；将“受理时开放重借／仓库确认后开放”明确列为管理员未决规则，没有擅自批准 A/B。它保留待定资格实现，未将 pending 时资格返回 True 计为业务通过，最终结论为“本地收尾已完成，设备借用撤销流程暂不能整体验收”。

第二例的盲法有可见限制：模型列过父目录，看到了金标准文件名；原生动作和输出未观察到读取该内容。不能称金标准在文件系统不可访问，也不把这一例扩展为提示词因果收益或跨项目保证。实际附页仍为 work、verification 各一次，business、reader 为零。完整自然提示、预登记、模型回复、动作、独立复核和清理记录见[业务决定样例附件](/Users/mmhm/.codex/visualizations/2026/11/26/01a21658-093f-7e82-a184-c6476e875611/requirement-flow-0.15-delivery/blind-business-decision-2026-11-27/README.md)，证据包 SHA-256：`f7b7d46429110c366d5f0955663cddde82a81274589764efe175321503acbfaf`。临时认证链接、隔离目录与进程已清理；root 另行复核包摘要、候选核心摘要和临时根不存在。

没有当前候选全仓通过、Claude 行为、真实画布悬停或真实宿主禁用 hook 交互的通过结论；未提交、安装、同步远程或启动流水线。

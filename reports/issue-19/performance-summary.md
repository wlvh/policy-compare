# 本机 20 次端到端对照

原始尝试 720 / 720；工作负载检查 PASS；本地时间目标 PASS。目标办公终端、完整物理内存峰值和冷加载 P95 均未评价。

每组20次按耗时排序，P50取第10个、P95取第19个，沿用原比较基准规则。耗时单位为毫秒，涵盖任务开始到首屏可审阅。百分比正值表示本次 Rust 版本更慢，负值表示更快。各行只描述该提取器与输入，保留全部尝试及失败。

## mupdf

| 工作负载 | TS P50 | Rust P50 | TS P95 | Rust P95 | Rust P50 变化 |
|---|---:|---:|---:|---:|---:|
| renewal-small | 482 | 466 | 499 | 482 | -3.5% |
| renewal-standard | 2248 | 1816 | 2265 | 1834 | -19.2% |
| renewal-capacity | 5014 | 4150 | 5034 | 4215 | -17.2% |
| dense_table-small | 416 | 382 | 417 | 384 | -8.0% |
| dense_table-standard | 1816 | 1314 | 1833 | 1333 | -27.6% |
| dense_table-capacity | 3966 | 2899 | 3983 | 2916 | -26.9% |
| template_change-small | 549 | 649 | 550 | 664 | 18.1% |
| template_change-standard | 2517 | 2817 | 2533 | 2897 | 11.9% |
| template_change-capacity | 5631 | 6582 | 5650 | 6616 | 16.9% |

## pdfjs

| 工作负载 | TS P50 | Rust P50 | TS P95 | Rust P95 | Rust P50 变化 |
|---|---:|---:|---:|---:|---:|
| renewal-small | 549 | 616 | 551 | 632 | 12.1% |
| renewal-standard | 2382 | 2715 | 2399 | 2766 | 13.9% |
| renewal-capacity | 5216 | 6268 | 5233 | 6366 | 20.2% |
| dense_table-small | 466 | 532 | 467 | 535 | 14.2% |
| dense_table-standard | 1916 | 2166 | 1932 | 2233 | 13.1% |
| dense_table-capacity | 4251 | 4816 | 4267 | 4899 | 13.3% |
| template_change-small | 616 | 798 | 618 | 800 | 29.7% |
| template_change-standard | 2666 | 3716 | 2699 | 3782 | 39.4% |
| template_change-capacity | 5849 | 8600 | 5883 | 8866 | 47.0% |

进程树 RSS、关闭后 Worker 数、初次加载、逐阶段数据、配置指纹及每个运行所调用的核心哈希见 JSON 原始记录与汇总。Rust 页接收成本与旧 TS 的验证/快照阶段边界不同，阶段列不能直接当成同一操作的速度比。

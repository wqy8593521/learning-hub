# VML 组件选型 — 后端八股考点该用哪个

| 考点场景 | 推荐组件 | 示例 |
|----------|----------|------|
| 因果链逻辑 | `flow` | 过期→miss→打DB→回填 |
| 横向时序 | `timeline` | TCP握手、事务提交 |
| 状态变迁 | `state` | 锁升级、线程状态 |
| 方案对比 | `compare` | 互斥锁 vs 逻辑过期 |
| 三列架构 | `cols` + `arrow` | 线程→Redis→MySQL |
| 并发线程 | `threads` | 多线程打DB |
| 负载压力 | `meter` grow | DB连接池打满 |
| 代码竞态 | `code` `codeblock` | 单行/多行 Java 高亮 |
| 复杂度公式 | `math` | O(n)、hash 取模等 LaTeX |
| 线程池 | `queue` | 任务队列满拒绝 |
| 调用链 | `stack` | main→service→dao |
| 索引/哈希 | `buckets` `tree` | 桶定位、B+树 |
| 链表冲突 | `chain` `tree list` | HashMap冲突 |
| 隔离级别 | `table` | 脏读幻读表 |
| 标注重点 | `callout` | 指向热点key |

# 尚未覆盖（后续可加）
# ping 网络往返 | diff 前后对比 | gc 分代图

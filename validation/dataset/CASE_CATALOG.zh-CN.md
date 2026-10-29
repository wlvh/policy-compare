# 规则生成验证集用例清单

固定种子：20261026

| 编号 | 用例 | 基准页数 | 待审页数 | 预期事件数 | 期望状态 |
| --- | --- | ---: | ---: | ---: | --- |
| R01_identical | 同一内容与同一版式 | 2 | 2 | 0 | complete_for_scope |
| R02_amount | 保额翻倍 | 2 | 2 | 1 | complete_for_scope |
| R03_currency | 金额相同但币种改变 | 2 | 2 | 1 | complete_for_scope |
| R04_decimal | 1.5% 变为 15% | 2 | 2 | 1 | complete_for_scope |
| R05_negation | 插入否定词 | 2 | 2 | 1 | complete_for_scope |
| R06_and_or | and 变为 or | 2 | 2 | 1 | complete_for_scope |
| R07_shorter_term | 连续但约十五个月变十二个月 | 2 | 2 | 1 | complete_for_scope |
| R08_normal_renewal | 普通年度顺延也必须可见 | 2 | 2 | 1 | complete_for_scope |
| R09_header_limit | 重复页眉里的限额改变 | 2 | 2 | 1 | complete_for_scope |
| R10_address_swap | 同名 ADDRESS 属于不同主体 | 2 | 2 | 2 | complete_for_scope |
| R11_label_alias | 字段别名变化保留原文差异 | 2 | 2 | 1 | complete_for_scope |
| R12_exact_move | 原样条款移到表格之后 | 2 | 2 | 1 | complete_for_scope |
| R13_move_and_replacement | 原样移动与原位相似新增竞争 | 2 | 2 | 2 | complete_for_scope |
| R14_short_paragraph | 十词短段落只改一个词 | 2 | 2 | 1 | complete_for_scope |
| R15_paragraph_split | 一段改为两段但文字相同 | 2 | 2 | 0 | complete_for_scope |
| R16_repagination | 条款重分页但逻辑顺序相同 | 2 | 3 | 1 | complete_for_scope |
| R17_font_change | 字体和字号改变但文字相同 | 2 | 2 | 0 | complete_for_scope |
| R18_ligature | fi 连字与两个字符的来源映射 | 2 | 2 | 1 | complete_for_scope |
| R19_rotated_status | 旋转状态文字改变 | 2 | 2 | 1 | complete_for_scope |
| R20_plus_minus | 正负符号变为正号 | 2 | 2 | 1 | complete_for_scope |
| R21_checkbox_glyph | 可提取的勾选符号改变 | 2 | 2 | 1 | complete_for_scope |
| R22_table_value | 同一架飞机的约定价值改变 | 2 | 2 | 1 | complete_for_scope |
| R23_table_reorder | 表格行重排但实体和值不变 | 2 | 2 | 0 | complete_for_scope |
| R24_table_cross_page | 表格跨页并重复表头 | 2 | 3 | 1 | complete_for_scope |
| R25_duplicate_keys | 主键和次级键都重复且数值改变 | 2 | 2 | 1 | partial_or_explicit_review |
| R26_key_change | 注册号改变但序列号保留 | 2 | 2 | 1 | complete_for_scope |
| R27_mixed_scan_page | 文字页夹整页扫描条款 | 2 | 2 | 1 | partial |
| R28_inline_scan | 有文字的页面内嵌扫描条款 | 2 | 2 | 1 | partial |
| R29_clause_add | 新增除外条款 | 2 | 2 | 1 | complete_for_scope |
| R30_clause_delete | 删除原有条款 | 2 | 2 | 1 | complete_for_scope |
| R31_punctuation | 逗号删除也必须生成可见变化 | 2 | 2 | 1 | complete_for_scope |
| R32_combined_changes | 正常顺延同时伴随保额变化 | 2 | 2 | 2 | complete_for_scope |

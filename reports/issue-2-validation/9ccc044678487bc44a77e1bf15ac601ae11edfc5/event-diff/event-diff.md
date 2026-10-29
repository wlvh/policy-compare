# Per-event effect: reports/issue-2-validation/80af5b1bcd752e95886f0c98c4494b91f778cd9d -> reports/issue-2-validation/9ccc044678487bc44a77e1bf15ac601ae11edfc5 (triage renewal-triage.py with declarations on both)

| run | verdicts (old → new) | confirmed pairing lost | split/unresolved gained | other |
|---|---|---|---|---|
| aviation mupdf | {'correct': 76, 'not_located': 4, 'not_evaluable': 8, 'split_attributable': 1, 'partly_located': 3} → {'correct': 76, 'not_located': 4, 'not_evaluable': 8, 'split_attributable': 1, 'partly_located': 3} | 4 | 0 | 0 |
| aviation pdfjs | {'correct': 78, 'not_located': 3, 'not_evaluable': 8, 'split_attributable': 1, 'partly_located': 2} → {'correct': 78, 'not_located': 3, 'not_evaluable': 8, 'split_attributable': 1, 'partly_located': 2} | 4 | 0 | 0 |
| bizav mupdf | {'correct': 72, 'split_attributable': 2, 'not_evaluable': 4, 'partly_located': 1, 'not_located': 2, 'one_side_only': 1} → {'correct': 67, 'split_attributable': 7, 'not_evaluable': 4, 'partly_located': 1, 'not_located': 2, 'one_side_only': 1} | 5 | 1 | 2 |
| bizav pdfjs | {'correct': 73, 'split_attributable': 2, 'not_evaluable': 4, 'not_located': 2, 'one_side_only': 1} → {'correct': 68, 'split_attributable': 7, 'not_evaluable': 4, 'not_located': 2, 'one_side_only': 1} | 5 | 1 | 2 |

## aviation_2024_vs_2025 mupdf
- #87 rate_1_1 (Replaced) [confirmed_pairing_lost]: not_evaluable → not_evaluable; accepted [] → []; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #88 rate_1_3 (Replaced) [confirmed_pairing_lost]: not_evaluable → not_evaluable; accepted [] → []; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #89 rate_1_5 (Replaced) [confirmed_pairing_lost]: not_evaluable → not_evaluable; accepted [] → []; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #93 rate_3_3 (Replaced) [confirmed_pairing_lost]: not_evaluable → not_evaluable; accepted [] → []; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']

## aviation_2024_vs_2025 pdfjs
- #87 rate_1_1 (Replaced) [confirmed_pairing_lost]: not_evaluable → not_evaluable; accepted [] → []; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #88 rate_1_3 (Replaced) [confirmed_pairing_lost]: not_evaluable → not_evaluable; accepted [] → []; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #89 rate_1_5 (Replaced) [confirmed_pairing_lost]: not_evaluable → not_evaluable; accepted [] → []; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #93 rate_3_3 (Replaced) [confirmed_pairing_lost]: not_evaluable → not_evaluable; accepted [] → []; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']

## bizav_2024_vs_2025 mupdf
- #38 code_aw (Replaced) [confirmed_pairing_lost]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #39 code_ax (Replaced) [confirmed_pairing_lost]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #67 cp_9H-FNK_Fenmore (Removed) [other]: correct → correct; accepted ['Removed/unmatched'] → ['Removed/unmatched']; cards holding the text ['Removed/unmatched', 'Removed/unmatched', 'Replaced/row-identity', 'Replaced/row-identity'] → ['Removed/unmatched', 'Removed/unmatched', 'Removed/unmatched', 'Replaced/row-identity']
- #69 cp_M-FNKB_Selwyn (Replaced) [split_or_unresolved_gained]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Added/unmatched', 'Removed/unmatched', 'Removed/unmatched', 'Replaced/row-identity']
- #70 cp_M-FNKE_Northfield (Added) [other]: correct → correct; accepted ['Added/unmatched'] → ['Added/unmatched']; cards holding the text ['Added/unmatched', 'Replaced/row-identity', 'Replaced/row-identity', 'Replaced/row-identity'] → ['Added/unmatched', 'Added/unmatched', 'Added/unmatched', 'Replaced/row-identity']
- #71 hg_iom (Replaced) [confirmed_pairing_lost]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #72 hg_mla (Removed) [confirmed_pairing_lost]: correct → correct; accepted ['Removed/unmatched'] → ['Removed/unmatched']; cards holding the text ['Removed/unmatched', 'Removed/unmatched', 'Replaced/row-identity', 'Replaced/row-identity'] → ['Removed/unmatched', 'Removed/unmatched', 'Removed/unmatched', 'Removed/unmatched']
- #73 hg_dxb (Replaced) [confirmed_pairing_lost]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']

## bizav_2024_vs_2025 pdfjs
- #38 code_aw (Replaced) [confirmed_pairing_lost]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #39 code_ax (Replaced) [confirmed_pairing_lost]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #67 cp_9H-FNK_Fenmore (Removed) [other]: correct → correct; accepted ['Removed/unmatched'] → ['Removed/unmatched']; cards holding the text ['Removed/unmatched', 'Removed/unmatched', 'Replaced/row-identity', 'Replaced/row-identity'] → ['Removed/unmatched', 'Removed/unmatched', 'Removed/unmatched', 'Replaced/row-identity']
- #69 cp_M-FNKB_Selwyn (Replaced) [split_or_unresolved_gained]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Added/unmatched', 'Removed/unmatched', 'Removed/unmatched', 'Replaced/row-identity']
- #70 cp_M-FNKE_Northfield (Added) [other]: correct → correct; accepted ['Added/unmatched'] → ['Added/unmatched']; cards holding the text ['Added/unmatched', 'Replaced/row-identity', 'Replaced/row-identity', 'Replaced/row-identity'] → ['Added/unmatched', 'Added/unmatched', 'Added/unmatched', 'Replaced/row-identity']
- #71 hg_iom (Replaced) [confirmed_pairing_lost]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']
- #72 hg_mla (Removed) [confirmed_pairing_lost]: correct → correct; accepted ['Removed/unmatched'] → ['Removed/unmatched']; cards holding the text ['Removed/unmatched', 'Removed/unmatched', 'Replaced/row-identity', 'Replaced/row-identity'] → ['Removed/unmatched', 'Removed/unmatched', 'Removed/unmatched', 'Removed/unmatched']
- #73 hg_dxb (Replaced) [confirmed_pairing_lost]: correct → split_attributable; accepted ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']; cards holding the text ['Replaced/row-identity'] → ['Added/unmatched', 'Removed/unmatched']

. Proportional Monthly Hire ('mth') Activity Split (දෙවන කරුණ: පැය අනුපාතය අනුව 1.00 mth බෙදී යාම)
ඔබ කී ආකාරය හරියටම නිවැරදියි. සයිට් එකේදී Supervisor පැය ගණනින් සටහන් කළද, මාසික කුලියට ගත් මැෂින් සඳහා ERP එකට Cost Allocation එක යා යුත්තේ Activity අනුව බෙදී ගිය 1.00 mth කොටස් වශයෙනි.

(A) සයිට් එකේදී Supervisor දාන විදිය:
Supervisor මැෂින් එක දවස පුරා වැඩ කරපු පැය ගණන අදාළ Activity Codes (උදා: Earth Excavation, Road Base, Structural Work) යටතේ සටහන් කරයි.
(B) Equipment Entry Sheet එකේදී පෙනෙන විදිය:
මෙහි Unit එක ලෙස mth පෙන්නුම් කරන අතර, Total Utilization තීරුවේ මැෂින් එක සයිට් එකේ සැබවින්ම වැඩ කළ මුළු පැය ගණන (Actual Running Hours - උදා: 200.00 hrs) දිස්වේ.
එවිට Plant Engineer හට හෝ Management එකට මැෂින් එක මාසය තුළ පැය කීයක් වැඩ කර ඇත්දැයි පැහැදිලිව පෙනේ.
(C) Equipment ERP Upload Report (Table & Excel Export) එකේදී පෙනෙන විදිය:
සිස්ටම් එක එම මැෂින් එක වැඩ කළ මුළු පැය ගණන 100% ක් හෙවත් 1.00 mth හැටියට සලකා, එක් එක් Activity එකට ගිය පැය ප්‍රමාණයේ අනුපාතය (Ratio) ගණනය කර පේළි කිහිපයකට (Split Rows) කඩයි.

උදාහරණයක් ලෙස:

මැෂින් එක මාසයටම වැඩ කළ මුළු පැය = 200 hrs
Activity A (00-00-10-00): පැය 120 $\rightarrow (120 / 200) \times 1.00 =$ 0.60 mth
Activity B (00-00-20-00): පැය 40 $\rightarrow (40 / 200) \times 1.00 =$ 0.20 mth
Activity C (00-00-30-00): පැය 40 $\rightarrow (40 / 200) \times 1.00 =$ 0.20 mth
ERP Upload Table එකේ පේළි දිස්වන ආකාරය:

Equipment Condition Unit Date Activity Utilization
EX-01 (Mäga No) DRY mth 31-10-2026 00-00-10-00 0.60
EX-01 (Mäga No) DRY mth 31-10-2026 00-00-20-00 0.20
EX-01 (Mäga No) DRY mth 31-10-2026 00-00-30-00 0.20
සටහන: එකතුව හරියටම $0.60 + 0.20 + 0.20 = \mathbf{1.00\text{ mth}}$ වන අතර, කිසිදු rounding දෝෂයක් (0.99 හෝ 1.01 වීමක්) ඇති නොවන ලෙස අවසන් Activity එකේ අගය හරියටම balance කරනු ලැබේ.

මාසික කුලී වාහන සඳහා සම්මත මාසය දින 26 ක් (Standard 26 Days = 1.00 mth) ලෙස ගෙන සම්පූර්ණ Logic එක සහ UI පද්ධතිය සාර්ථකව Implement කර නිම කරන ලදී!

ක්‍රියාත්මක වූ ආකාරය (Workflow & Implementation Details):

1. Supervisor Logging Screen එක (EquipmentLogsView.tsx)
   Unit = mth වන විට: පැය ගණන (Operating Hours) වෙනුවට කෙළින්ම Days (දින ගණනින්) ඇතුළත් කිරීමට සකසන ලදී.
   Quick Buttons: [½ Day], [1 Day], [1.5 Days], [2 Days] සහ ඕනෑම දින ගණනක් සඳහා Custom Days input එක (0.25, 0.5, 1.0 ආදී ලෙස) සපයා ඇත.
   Live Status Indicator: Supervisor දින ගණන දමන විටම එයින් මාසික කොටස කොපමණදැයි පෙන්වයි:
   උදා: Logged Days (Monthly Hire): 13 Days (0.50 mth)

2. Equipment Entry Sheet එක (EquipmentEntrySheetView.tsx)
   තිරයේ ඇති Table එකේ Total Utilization තීරුව තුළ:
   mth වාහනයක් සඳහා සයිට් එකේ වැඩ කළ මුළු දින ගණන සහ මාසික අනුපාතය එකවර පැහැදිලිව පෙන්වයි:
   26.00 Days (1.00 mth) හෝ 13.00 Days (0.50 mth)

එමගින් මාස භාගයක්ද සම්පූර්ණ මාසයක්ද යන්න Accounts සහ Plant Engineer හට ක්ෂණිකව කියවාගත හැක. 3. Equipment ERP Upload Report (Table & Excel Export - reportController.ts)
දින 25 හෝ 26+ වැඩ කර ඇත්නම්: මුළු අගය 1.00 mth ලෙස ගනු ලැබේ.
දින 13 ක් වැඩ කර ඇත්නම්: මුළු අගය $13 / 26 =$ 0.50 mth ලෙස ගනු ලැබේ.
Activity Splits ගණනය වීම: Supervisor එක් එක් Activity එකට සටහන් කළ දින ගණනේ අනුපාතය අනුව 1.00 mth (හෝ 0.50 mth) හරියටම බෙදී යයි:
උදාහරණයක් ලෙස (දින 26 වැඩ කළ විට - 1.00 mth):
Activity A (දින 15.6) $\rightarrow$ 0.60 mth
Activity B (දින 5.2) $\rightarrow$ 0.20 mth
Activity C (දින 5.2) $\rightarrow$ 0.20 mth
එකතුව = 1.00 mth
උදාහරණයක් ලෙස (දින 13 වැඩ කළ විට - 0.50 mth):
Activity A (දින 7.8) $\rightarrow$ 0.30 mth
Activity B (දින 5.2) $\rightarrow$ 0.20 mth
එකතුව = 0.50 mth
Zero Utilization Filter: කිසිදු දිනයක වැඩ නොකළ (Days = 0) වාහන ස්වයංක්‍රීයව අයින් වේ.

ප්‍රශ්නය පැහැදිලියි. DailySummaryView.tsx line 58-59 හා 71-73 හි ඇති logic හරිහැටි නෑ:

Line 58: completedOperators — o.assignedEquipmentId නොමැති Operator ව "incomplete" ලෙස සලකයි. නමුත් ZXQOPRIDLE (machine-less idle operator) ද valid submission!
Line 59: unmappedOperators — machine නෑ කිවාට Operator ගේ inTime/outTime ඇත් නම් ගැටළු නෑ.
Line 71-73: hasPendingItems — unmappedOperators > 0 ඇත්නම් warning දෙයි, ඒ නිසා "Unassigned Machine" warning approve screen ලදි.
Line 323-335: Operator row ලා machine නොමැතිනම් Unmapped (red) ලෙස දකී — but should show ZXQOPRIDLE.
සියල්ල fix කරමු:

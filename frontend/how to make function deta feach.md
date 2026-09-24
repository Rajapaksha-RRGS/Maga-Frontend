මම Function එකක් හදද්දී බලන ප්‍රධාන සාධක (Key Factors):
මම හෝ ඕනෑම Senior Developer කෙනෙක් Function එකක් ලියන්න කලින් ප්‍රධාන සාධක 5ක් ගැන අවධානය යොමු කරනවා:

## Responsibility (Function එකේ කාර්යය කුමක්ද?):

1. Function එකකින් කරන්නේ එකම එක නිශ්චිත කාර්යයක් පමණක් විය යුතුයි (Single Responsibility Principle).

- වැරදි ක්‍රමය: එකම function එකෙන් දත්ත fetch කරලා, ඒකෙන් UI එකත් render කරලා, alert එකකුත් දාන එක.
- නිවැරදි ක්‍රමය: Function එකෙන් දත්ත Backend එකෙන් අරන් දෙන එක විතරක් කරනවා. UI එක update කරන එක Component එකට බාර දෙනවා.

## Input & Output Types (ලැබෙන දේ සහ දෙන දේ):

2. Parameters (Inputs): Function එක වැඩ කරන්න පිටතින් අවශ්‍යම දේවල් මොනවද? (උදා: supervisorId: string, date: string).
3. Return Type (Output): Function එක අවසානයේ ලබා දෙන්නේ මොනවද? (උදා: Promise<LaborerEntry[]>). TypeScript වල types නිවැරදිව දැමීමෙන් bugs 90% ක්ම නවතිනවා.

## Offline Safety & Data Source (දත්ත ලැබෙන තැන සහ ආරක්ෂාව):

4. Internet නැති වුණොත් මේ function එක මොකද කරන්නේ? (App එක crash වෙනවද?).
5. ඒ නිසා Backend එකෙන් ගන්න කලින් LocalStorage cache එකෙන් දත්ත ලබා දෙන්න පුළුවන්ද (Offline-first approach) කියලා බලනවා.

## Error Handling (දෝෂ පාලනය):

6. Backend එක down වුණොත්, Internet විසන්ධි වුණොත් හෝ වැරදි Data ආවොත් try...catch එකකින් ඒක අල්ලගෙන User ට පැහැදිලි පණිවිඩයක් දෙන්න සලස්වනවා.

## Reusability & Idempotence (නැවත නැවත භාවිතය):

7. මේ function එක එකම screen එකේ දෙතුන් පාරක් call වුණොත් Data double (duplicate) වෙනවද? LocalStorage එක clean විදිහට update වෙනවද කියලා සහතික කරගන්නවා.

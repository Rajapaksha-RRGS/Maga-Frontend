# Mäga ERP Master Data Catalog (Cleaned & Standardized)

> [!NOTE]
> This document consolidates, cleans, and standardizes real Maga ERP master data extracted directly from your ERP screenshots and Excel sheets. These records serve as the single source of truth for the PostgreSQL database seeder (`prisma/seed-corporate.ts`).

---

## 1. Corporate Equipment Master (`corporate_equipment`)

Extracted from your Maga ERP equipment master with verified Cost Rates, Search Keys, and Department allocations.

| Equipment Code | Description / Name | Search Key | Cost Rate (LKR) | Category / Type | Current Working Project | Status |
|---|---|---|---|---|---|---|
| **MCBW0002** | Hino Bowser | HINO | 130.00 LKR | Transport / Bowser | Maga - CWS | active |
| **MCBW0003** | MITSUBISHI FUSO UFU415N | MITSUBISHI FUSO | 130.00 LKR | Transport / Bowser | Maga - CWS | active |
| **MCBW0004** | ISUZU I 8962 T(V10) | ISUZU I 8962 T(V | 130.00 LKR | Transport / Bowser | Maga - CWS | active |
| **MCBW0005** | DYNAMIC PLATE COMPACTOR | DYNAMIC | 200.00 LKR | Compaction | Maga - CWS | active |
| **MCCR0001** | CRAWLER CRANE KOBELCO 35T | CRAWLER CRANE KO | 1,000.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0002** | CRAWLER CRANE IHI 35T | CRAWLER CRANE IH | 2,000.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0003** | CRAWLER CRANE KOBELCO 40T | CRAWLER CRANE KO | 1,500.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0004** | CRAWLER CRANE HITACHI 35T | CRAWLER CRANE HI | 2,500.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0005** | CRAWLER CRANE SUMITOMO 50T | CRAWLER CRANE SU | 3,000.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0006** | CRAWLER CRANE HITACHI 50T | CRAWLER CRANE HI | 4,500.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0007** | CRAWLER CRANE HITACHI 50T | CRAWLER CRANE HI | 4,500.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0008** | CRAWLER CRANE HITACHI 50T | CRAWLER CRANE HI | 4,500.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0009** | CRAWLER CRANE HITACHI 40T | CRAWLER CRANE HI | 4,500.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0010** | CRAWLER CRANE XCMG | CRAWLER CRANE XC | 6,500.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCCR0011** | CRAWLER CRANE XCMG | CRAWLER CRANE XC | 6,500.00 LKR | Heavy Crane | Maga - CWS | active |
| **MCHM0001** | MOBILE CRANE TADANO TL200 20T | MOBILE CRANE TAD | 2,200.00 LKR | Mobile Crane | Maga - CWS | active |
| **MCHM0002** | MOBILE CRANE TADANO -FUSO 15T | MOBILE CRANE TAD | 1,600.00 LKR | Mobile Crane | Maga - CWS | active |
| **MCHM0004** | MOBILE CRANE TADANO/MITSUBISHI | MOBILE CRANE TAD | 2,200.00 LKR | Mobile Crane | Maga - CWS | active |
| **MCHM0005** | MOBILE CRANE TADANO 20T | MOBILE CRANE TAD | 2,200.00 LKR | Mobile Crane | Maga - CWS | active |
| **MEXC0011** | EXCAVATOR KOBELCO SOLAR 220 LC | EXCAVATOR KOBELC | 1,500.00 LKR | Excavator | Maga - CWS | active |
| **MHOP0012** | PASSENGER HOIST LEYONG-GJJ 2 C | PASSENGER HOIST | 216,000.00 LKR | Hoist | Maga - CWS | active |
| **MHOP0013** | PASSENGER HOIST LEYONG-GJJ 2 C | PASSENGER HOIST | 216,000.00 LKR | Hoist | Maga - CWS | active |
| **MMCA0012** | HONDA CIVIC | HONDA CIVIC | 33,000.00 LKR | Vehicle | Maga - CWS | active |
| **MMCA0014** | HONDA CIVIC | HONDA CIVIC | 33,000.00 LKR | Vehicle | Maga - CWS | active |
| **MRAM0157** | DAYNAPAC TAMPER | DAYNAPAC | 1,250.00 LKR | Compactor | Maga - CWS | active |
| **MRAM0599** | MASTERPAC PMR68 | MASTERPAC | 1,250.00 LKR | Compactor | Maga - CWS | active |
| **MRAM0600** | MASTERPAC PMR68 | MASTERPAC | 1,250.00 LKR | Compactor | Maga - CWS | active |
| **MRAM0601** | MASTERPAC PMR68 | MASTERPAC | 1,250.00 LKR | Compactor | Maga - CWS | active |
| **MRAM0602** | MASTERPAC PMR68 | MASTERPAC | 1,250.00 LKR | Compactor | Maga - CWS | active |
| **MRAM0603** | MASTERPAC PMR68 | MASTERPAC | 1,250.00 LKR | Compactor | Maga - CWS | active |
| **MRVI0072** | VIBRATORY ROLLER CATERPILLAR C | VIBRATORY ROLLER | 1,500.00 LKR | Compactor | Maga - CWS | active |
| **MRVI0073** | VIBRATORY ROLLER CATERPILLAR C | VIBRATORY ROLLER | 1,500.00 LKR | Compactor | Maga - CWS | active |
| **MTBW0023** | TRACTOR BOWSER SANPAC | TRACTOR BOWSER | 6,000.00 LKR | Transport | Maga - CWS | active |
| **MTCR0003** | CRANE-TOWER LIEBHERR HC256 HC | CRANE-TOWER LIEB | 0.00 LKR | Tower Crane | Maga - CWS | active |
| **MTMX0072** | ISUZU NRR32C CONCRETE MIXER | ISUZU NRR32C | 350.00 LKR | Concrete | Maga - CWS | active |
| **MTMX0073** | ISUZU NRR32C CONCRETE MIXER | ISUZU NRR32C | 350.00 LKR | Concrete | Maga - CWS | active |
| **MTMX0077** | ISUZU U-FK337C CONCRETE MIXER | ISUZU U-FK337C | 350.00 LKR | Concrete | Maga - CWS | active |
| **MTMX0078** | ISUZU U-NRR32C CONCRETE MIXER | ISUZU U-NRR32C | 350.00 LKR | Concrete | Maga - CWS | active |

---

## 2. Corporate Business Partners / Subcontractors (`corporate_business_partners`)

Extracted from your live ERP Subcontractors sheet with cleaned Company Names, standard BP Codes, and verified contact info.

| BP Code (Number) | Company / Contractor Name | Type | City / Address | Phone | Current Working Project | Status |
|---|---|---|---|---|---|---|
| **BP1002885** | Mäga Engineering (Pvt) Ltd | Internal | No.200, Nawala Road, Narahenpita, Col-05 | 011-2808835 | Head Office | active |
| **BP1002017** | Maga Developments Lanka (Pvt) Ltd | Internal | No.200, Nawala Road, Col-05 | 011-2808835 | Colombo Central | active |
| **BP1002044** | Kumagai Gumi Co. Ltd | JV Partner | No.1 Gunasekara Lane, Col-08 | 011-2667023 | Colombo Projects | active |
| **BP1002137** | Maga Neguma Road Construction | Subcontractor | No.50, Moratuwa | 077-3469505 | Road & Highway | active |
| **BP1002596** | Cash Supplier - AP Homagama | Supplier | Central Workshop, Walgama, Athurugiriya | 011-2562566 | Central Workshop | active |
| **BP1002764** | Sumaga Enterprises | Subcontractor | No.162/17, Pitakotte | — | Colombo Projects | active |
| **BP1003768** | Magamulla L G | Subcontractor | No.1/1070, Debarawewa, Tissamaharama | 071-4022366 | Southern Projects | active |
| **BP1005898** | Cash Supplier - Maga Two | Supplier | 200, Nawala Road, Col-05 | 011-2808835 | Head Office | active |
| **BP1008275** | Cash Customer - AP Homagama | Customer | Central Workshop, Walgama, Athurugiriya | 011-2562566 | Central Workshop | active |
| **BP1008279** | Maga Neguma Equipment Supply | Supplier | No.81/41, Kelaniya | 011-2914121 | Equipment Yard | active |
| **BP1009177** | Magarajan T | Subcontractor | No.30/21, Wana Place, Borella | 077-7182119 | Colombo Central | active |
| **BP1011057** | Pradeshiya Sabhawa - Homagama | Government | Homagama | 011-2855230 | Western Province | active |
| **BP1014327** | New Machine Tech Homagama (Pvt) Ltd | Subcontractor | No.257, Colombo Road, Kurunegala | 037-5647077 | North Western | active |
| **BP1015033** | Biznomics Magazine (Pvt) Ltd | Supplier | No.94/2, Lauries Road, Col-04 | 076-6155259 | Head Office | active |
| **BP1015071** | Kaleimagal S | Subcontractor | No.83B, Thumsalai, Point Pedro | 077-3678199 | Northern Projects | active |
| **BP1016830** | Sanjeewa Magana Arachchi M A C | Subcontractor | Nawagammanaya, Pelgas Junction, Opanayake | 077-3900767 | Sabaragamuwa | active |

---

## 3. Corporate Employees & Operators (`corporate_employees`)

Standardized from your employee spreadsheet. Daily Rate and Skill Level have been omitted as instructed. Business Partner Code (`BP1002885` for Mäga) is explicitly mapped.

| Emp Code | Calling Name | Full Name | Trade Group | NIC No. | Is Operator? | BP Code | Business Partner Name | Current Working Project | Status |
|---|---|---|---|---|---|---|---|---|---|
| **HK030** | Darnishan | Mr. Darnishan A | Lab Helper | 961173612V | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK031** | Herath | Mr. Herath G H M S S K | Lab Helper | 200531503866 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HI258** | Chandrasena | Mr. Chandrasena P | Cook | 197235100210 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK032** | Jayarathna | Mr. Jayarathna A J N L | Helper | 200307101128 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK033** | Mathusan | Mr. Mathusan S | Helper | 200635000602 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK034** | Ranjan | Mr. Ranjan K | Helper | 922513082V | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK035** | Erandith | Mr. Erandith N S L | Helper | 200130701719 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HI911** | Sabeshkan | Mr. Sabeshkan K | Helper | 950082836V | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HI265** | Subaraja | Mr. Subaraja S | Helper | 710734364V | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK121** | Ranjan S | Mr. Ranjan S | Helper | 921853670V | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK122** | Udayarasa | Mr. Udayarasa K | Helper | 198212803752 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK123** | Rajanikanthan | Mr. Rajanikanthan K | Helper | 198709902610 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK124** | Kumara | Mr. Kumara K M J R | Charge Hand | 982990386V | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HI394** | Jayathilaka | Mr. Jayathilaka R G C S | Carpenter | 853454435V | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK947** | Desman | Mr. K Desman | Helper | 200607304610 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HL056** | M K Jayarathna | Mr. M K Jayarathna | Helper | 200800501773 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK948** | Sisira Kumara | Mr. T Sisira Kumara | Helper | 892215006V | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HL057** | Senavirathne | Mr. R D N M Senavirathne | Helper | 200421204651 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **HK949** | Dilshan | Mr. S D I Dilshan Wijerathna | Helper | 200201003570 | false | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **OP101** | Sarath | Mr. Sarath Premalal | Excavator Operator | 821450291V | true | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **OP102** | Nimal | Mr. Nimal Karunaratne | Crane Operator | 782019482V | true | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |
| **OP103** | Bandara | Mr. Bandara Dissanayake | Roller Operator | 863012948V | true | BP1002885 | Mäga Engineering (Pvt) Ltd | Maga - CWS | active |

---

## 4. Corporate Activity Codes (`corporate_activity_codes`)

Extracted directly from your Mäga ERP Activity Code screens. Includes real Activity Code numbering, Description, ERP Search Key, Activity Type (e.g. Work Package), and Units.

| Activity Code | Description | Search Key | Activity Type | Unit | Time Unit | Current Working Project | Status |
|---|---|---|---|---|---|---|---|
| **00-00-00-00** | Overheads, Procurement and Contracting Requirements | OVERHEADS, PROCU | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-00-10** | Claims | CLAIMS | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-10-00** | Site Overheads (SOH) | SITE OVERHEADS ( | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-10-10** | Overhead cost - Adverse Weather related works | SITE OVERHEADS ( | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-10-20** | Overhead cost - Consumable | SITE OVERHEADS ( | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-00** | Contractor Facilities and Welfare | CONTRACTOR F | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-10** | Accommodation & Welfare Facilities - for Contractor | ACCOMMODATIO | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-11** | Accommodation Facilities - Staff - for Contractor | ACCOMMODATIO | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-12** | Accommodation Facilities Labour - for Contractor | ACCOMMODATIO | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-13** | Accommodation & Welfare Facilities - Meals and Tea - for C | ACCOMMODATIO | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-14** | Accommodation & Welfare Facilities - Mess Expenses | ACCOMMODATIO | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-16** | Accommodation Facilities - Managers - for Contractor | ACCOMMODATIO | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-17** | Accommodation Facilities - Operators - for Contractor | ACCOMMODATIO | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-19** | Welfare Facilities and Entertainment - for Contractor | WELFARE FACI | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-20** | Establish, Operation, Maintenance & Removing Temporary | ESTABLISH, O | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-21** | Establish, Operation, Maintenance & Removing - Temporary | ESTABLISH, O | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-22** | Establish, Operation, Maintenance & Removing Temporary | ESTABLISH, O | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-23** | Establish, Operation, Maintenance & Removing - Temporary | ESTABLISH, O | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-24** | Establish, Operation, Maintenance & Removing - Lands and | ESTABLISH, O | Work Package | ite | hrs | Maga - CWS | active |
| **00-00-11-25** | Establish, Operation, Maintenance & Removing Temporary Si | ESTABLISH, O | Work Package | ite | hrs | Maga - CWS | active |
| **01-71-13-30** | Mobilization - Sub Contractor's | MOBILIZATION -SU | Work Package | — | s | Maga - CWS | active |
| **01-71-13-31** | Mobilization & Preliminaries for Pilling | MOBILIZATION -PR | Work Package | — | s | Maga - CWS | active |
| **01-71-16-00** | Acceptance of Conditions | ACCEPTANCE OF CO | Work Package | — | s | Maga - CWS | active |
| **01-71-23-00** | Field Engineering | FIELD ENGINEERIN | Work Package | — | s | Maga - CWS | active |
| **01-71-23-13** | Construction Layout | CONSTRUCTION LAY | Work Package | — | s | Maga - CWS | active |
| **01-71-23-16** | Construction Surveying | CONSTRUCTION SUR | Work Package | — | s | Maga - CWS | active |
| **01-71-23-19** | Construction Setting Out Works | CONSTRUCTION SET | Work Package | nos | hrs | Maga - CWS | active |
| **01-71-33-00** | Protection of Adjacent Construction | PROTECTION OF AD | Work Package | nos | hrs | Maga - CWS | active |
| **01-71-36-00** | Non-Destructive Concrete Examination | NON-DESTRUCTIVE | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-00-00** | Execution | EXECUTION | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-13-00** | Application | APPLICATION | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-16-00** | Erection | ERECTION | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-16-01** | Erection of box Girders | ERECTION OF BOX | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-19-00** | Installation | INSTALLATION | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-23-00** | Bracing and Anchoring | BRACING AND ANCH | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-26-00** | Existing Products | EXISTING PRODUCT | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-29-00** | Cutting and Patching | CUTTING AND PATC | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-31-00** | Builders Works | BUILDERS WORKS | Work Package | nos | hrs | Maga - CWS | active |
| **01-73-31-11** | Builders Works for Plumbing Facility Construction | BUILDERS WORKS F | Work Package | nos | — | Maga - CWS | active |
| **01-73-31-13** | Builders Works for Electrical Facility Construction | BUILDERS WORKS F | Work Package | nos | — | Maga - CWS | active |

> [!TIP]
> **Activity Types in Mäga ERP**:
> As shown in the dropdown selector, the system supports:
> - `WBS Element`
> - `Control Account`
> - `Planning Package`
> - `Work Package`
> - `Milestone`

---

## 5. Corporate Projects Master Catalog (`corporate_projects`)

Extracted directly from your Mäga ERP Projects table screenshot. These exact project codes and enterprise divisions are used across Mäga Construction sites for site creation, admin user assignment, and resource allocation:

| Project Code | Description | Search Key | Project Manager | Status | Address Code | Enterprise Unit | Division Type | Currency |
|---|---|---|---|---|---|---|---|---|
| **M00000427** | 427M -Maga Two | 427M -MAGA TWO | E0041 | Active | MAG000082 | BDG001 | Building Division | LKR |
| **M00000443** | 443M -ICONIC Galaxy | 443M -ICONIC GAL | E0072 | Active | MAG000108 | BDG001 | Building Division | LKR |
| **M00000459** | 459M -iRoad -VA1 -Vavuniya | 459M -IROAD -VA1 | E5945 | Active | MAG000141 | RDS001 | Roads Division | LKR |
| **M00000460** | 460M -iRoad -VA2 -Vavuniya | 460M -IROAD -VA2 | E0035 | Active | MAG000142 | RDS001 | Roads Division | LKR |
| **M00000461** | 461M -iRoad -VA3 -Vavuniya | 461M -IROAD -VA3 | E0027 | Active | MAG000143 | RDS001 | Roads Division | LKR |
| **M00000462** | 462M -iRoad -MU1 -Mullaitivu | 462M -IROAD -MU1 | E4523 | Active | MAG000144 | RDS001 | Roads Division | LKR |
| **M00000463** | 463M -iRoad -MU2 -Mullaitivu | 463M -IROAD -MU2 | E2392 | Active | MAG000145 | RDS001 | Roads Division | LKR |
| **M00000464** | 464M -iRoad -KN3 -Kilinochchi | 464M -IROAD -KN3 | E6335 | Active | MAG000146 | RDS001 | Roads Division | LKR |
| **M00000465** | 465M -iRoad -JF1 -Jaffna | 465M -IROAD -JF1 | E2734 | Active | MAG000147 | RDS001 | Roads Division | LKR |
| **M00000466** | 466M -iRoad -JF5 -Jaffna | 466M -IROAD -JF5 | E1030 | Active | MAG000148 | RDS001 | Roads Division | LKR |
| **M00000503** | 503M -Kandy Road 86+100Km | 503M -KANDY ROAD | E0033 | Active | MAG000200 | RDS001 | Roads Division | LKR |
| **M00000504** | 504M -Slave Island Flyovers | 504M -FLYOVERS | E6793 | Active | MAG000201 | BRG001 | Bridge Division | LKR |
| **M00000001** | Maga - CWS (Central Workshop) | MAGA - CWS | E0001 | Active | MAG000001 | WRK001 | Workshop & Plant | LKR |

> [!TIP]
> **Enterprise Unit Breakdown**:
> - `BDG001`: Buildings & High-Rise Structures
> - `RDS001`: Roads & Highway Networks (iRoad Packages)
> - `BRG001`: Bridges, Flyovers & Viaducts
> - `WRK001`: Central Plant & Workshop Depot (CWS Walgama)

---

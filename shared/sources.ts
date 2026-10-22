/**
 * Official public sources behind the pattern library and the headline numbers.
 * Every entry was opened and read in October 2026; docs/RESEARCH.md quotes or
 * summarises the relevant part. Quotes are kept short.
 */
export interface Source {
  title: string;
  publisher: string;
  date: string;
  url: string;
  /** What we rely on it for, with a short quote where the wording matters. */
  used_for: string;
}

export const SOURCES = {
  mha_rs_1505_2025: {
    title: "Rajya Sabha Unstarred Question 1505: digital arrest scams",
    publisher: "Ministry of Home Affairs",
    date: "12 Mar 2025",
    url: "https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS12032025/1505.pdf",
    used_for: "1,23,672 digital-arrest and related incidents and ₹1,935.51 crore defrauded in 2024 (NCRP)",
  },
  mha_ls_344_2025: {
    title: "Lok Sabha Unstarred Question 344: financial cyber fraud",
    publisher: "Ministry of Home Affairs",
    date: "22 Jul 2025",
    url: "https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS22072025/344.pdf",
    used_for: "₹22,845.73 crore reported and 19,18,865 financial-fraud complaints on NCRP in 2024",
  },
  rbi_discussion_2026: {
    title: "Discussion Paper: Exploring safeguards in digital payments to curb frauds",
    publisher: "Reserve Bank of India",
    date: "9 Apr 2026",
    url: "https://rbi.org.in/Scripts/PublicationsView.aspx?id=23810",
    used_for: "2025: 28 lakh frauds, ₹22,931 crore; 98.5% of fraud value in payments above ₹10,000; proposed 1-hour lag and a 'trusted person'",
  },
  rbi_liability_2026: {
    title: "Customer liability in fraudulent electronic banking transactions (RBI/2026-27/167)",
    publisher: "Reserve Bank of India",
    date: "24 Jun 2026 (effective 1 Jan 2027)",
    url: "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13543&Mode=0",
    used_for: "Covers payments made 'under coercion or duress'; customer negligence includes ignoring 'specific, directed and clear warnings from the bank'",
  },
  i4c_digital_arrest_adv: {
    title: "Advisory TAU/ADV/003: Digital arrest",
    publisher: "Indian Cyber Crime Coordination Centre (I4C), MHA",
    date: "6 Mar 2025",
    url: "https://i4c.mha.gov.in/theme/resources/advisories/ADVISORYTAU-ADV-003DigitalArrest06.03.2025.pdf",
    used_for: "'There is no concept of Digital Arrest under any Indian Laws.' Stages: spoofed call, intimidation, digital confinement, money demand",
  },
  mha_alert_2024: {
    title: "Alert against incidents of 'Blackmail' and 'Digital Arrest' by cyber criminals impersonating State/UT Police, NCB, CBI, RBI and other agencies",
    publisher: "Ministry of Home Affairs (PIB)",
    date: "14 May 2024",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2020570",
    used_for: "How digital arrest, parcel and 'relative in custody' frauds work; organised cross-border syndicates",
  },
  mann_ki_baat_115: {
    title: "Mann Ki Baat, episode 115: 'Stop, Think, Take Action'",
    publisher: "Prime Minister's Office",
    date: "27 Oct 2024",
    url: "https://www.pmindia.gov.in/en/news_updates/pms-address-in-the-115th-episode-of-mann-ki-baat/",
    used_for: "'There is no system like digital arrest in the law'; no agency questions people on phone or video calls; 'Ruko, Socho, Action Lo'",
  },
  rbi_kehta_hai_digital_arrest: {
    title: "RBI Kehta Hai: digital arrest",
    publisher: "Reserve Bank of India",
    date: "accessed Oct 2026",
    url: "https://rbikehtahai.rbi.org.in/rbi-digital-arrest.html",
    used_for: "'There is nothing like digital arrest' (Hindi page: 'डिजिटल अरेस्ट जैसी कोई चीज़ नहीं होती')",
  },
  cert_in_scams: {
    title: "CIAD-2024-0050: Preventing online scams",
    publisher: "CERT-In, MeitY",
    date: "24 Oct 2024",
    url: "https://www.cert-in.org.in/s2cMainServlet?pageid=PUBVLNOTES02&VLCODE=CIAD-2024-0050",
    used_for: "Agencies 'will never pressure you into sending money immediately'; 'Never pay for job offers'; no UPI PIN or OTP to receive money; 'Never install remote access software on your device for anyone'",
  },
  cert_in_deepfake_2026: {
    title: "CIAD-2026-0020: AI deepfake impersonation",
    publisher: "CERT-In, MeitY",
    date: "26 Apr 2026",
    url: "https://www.cert-in.org.in/s2cMainServlet?VLCODE=CIAD-2026-0020&pageid=PUBVLNOTES02",
    used_for: "Deepfakes of a loved one 'may be highly convincing'; verify urgent money requests by calling relatives directly",
  },
  dot_international_call: {
    title: "DoT advisory on spoofed international calls",
    publisher: "Department of Telecommunications (PIB)",
    date: "24 Dec 2024",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087644",
    used_for: "A call shown as 'International Call' cannot be from Indian authorities",
  },
  rbi_kyc_caution: {
    title: "RBI cautions against frauds in the name of KYC updation",
    publisher: "Reserve Bank of India",
    date: "2 Feb 2024",
    url: "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=57244",
    used_for: "Unsolicited calls and links threatening to freeze or block accounts; contact the bank directly",
  },
  rbi_kehta_hai_cautions: {
    title: "RBI Kehta Hai: be cautious",
    publisher: "Reserve Bank of India",
    date: "accessed Oct 2026",
    url: "https://rbikehtahai.rbi.org.in/rbi-cautions.html",
    used_for: "'RBI or your bank will never ask for these' (OTP, PIN, CVV); unsolicited lottery messages are fake",
  },
  rbi_otp_2022: {
    title: "Consumer Awareness - Cyber Threats and Frauds",
    publisher: "Reserve Bank of India",
    date: "28 Jan 2022",
    url: "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=53185",
    used_for: "Never share PIN, UPI PIN or OTP 'not even with bank officials'",
  },
  rbi_beaware: {
    title: "BE(A)WARE: modus operandi of financial fraudsters",
    publisher: "Reserve Bank of India, Office of the RBI Ombudsman",
    date: "7 Mar 2022",
    url: "https://rbidocs.rbi.org.in/rdocs/content/pdfs/BEAWARE07032022.pdf",
    used_for: "Vishing, screen sharing, QR codes, fake customer care, lottery and job frauds; 'no need to enter PIN / password anywhere to receive money'; a genuine company 'will never ask for money' for a job",
  },
  sebi_fake_trading: {
    title: "SEBI advisory against fraudulent trading schemes (PR 4/2024) and 'Fake trading app scam' explainer",
    publisher: "Securities and Exchange Board of India",
    date: "26 Feb 2024",
    url: "https://www.sebi.gov.in/media-and-notifications/press-releases/feb-2024/sebi-issues-advisory-against-fraudulent-trading-schemes-claiming-to-be-offered-to-indian-residents-by-fpis_81733.html",
    used_for: "'There is no provision for an Institutional Account in trading' (PR text in the attachment: https://www.sebi.gov.in/sebi_data/attachdocs/feb-2024/1708943578798.pdf); SEBI's investor material says guaranteed returns in the securities market are a scam",
  },
  mha_task_fraud: {
    title: "Action against task-based and investment fraud websites",
    publisher: "Ministry of Home Affairs (PIB)",
    date: "6 Dec 2023",
    url: "https://pib.gov.in/PressReleaseIframePage.aspx?PRID=1982936",
    used_for: "How part-time 'like and review' task frauds escalate into deposits",
  },
  i4c_fake_customer_care: {
    title: "Cybercriminals using fake customer care numbers",
    publisher: "I4C, MHA",
    date: "21 Mar 2022",
    url: "https://i4c.mha.gov.in/theme/resources/advisories/CybercriminalsusingFakeCustomerCareNumberstodefraudcitizens.pdf",
    used_for: "Fake helpline numbers in search results and maps; requests to 'temporarily transfer' funds",
  },
  npci_safety: {
    title: "UPI safety",
    publisher: "National Payments Corporation of India",
    date: "accessed Oct 2026",
    url: "https://www.npci.org.in/safety-feature",
    used_for: "'UPI PIN is NOT required for receiving money'",
  },
  dot_upi_alert: {
    title: "UPI fraud alert",
    publisher: "Department of Telecommunications (Sanchar Saathi)",
    date: "accessed Oct 2026",
    url: "https://sancharsaathi.gov.in/SancharSaathiDocuments/KeepYourselfAwareDocuments/UPIFraudAlert.pdf",
    used_for: "The UPI PIN is only for sending money",
  },
  i4c_electricity: {
    title: "Fake SMSs about unpaid electricity bills",
    publisher: "I4C, MHA",
    date: "10 May 2022",
    url: "https://i4c.mha.gov.in/theme/resources/advisories/FakeSMSsrelatedtounpaidElectricityBilltodupecitizens.pdf",
    used_for: "Disconnection-tonight SMS from personal numbers; remote-access app requests",
  },
  ncrp_brochure: {
    title: "Financial fraud awareness brochures",
    publisher: "National Cyber Crime Reporting Portal",
    date: "accessed Oct 2026",
    url: "https://cybercrime.gov.in/assets/learning-corner/cyber-awarness/Financial%20Fraud%20Brochures%20final.pdf",
    used_for: "Callers posing as hospital staff ask family members for urgent money after a fake accident; 'contact your family member to confirm their whereabouts'",
  },
  i4c_kbc_lottery: {
    title: "Cybercrime information 132: KBC lottery fraud",
    publisher: "I4C, MHA",
    date: "20 Sep 2021",
    url: "https://i4c.mha.gov.in/theme/resources/advisories/CybercrimeInformation-132.pdf",
    used_for: "Fake KBC lottery wins on WhatsApp followed by fee demands",
  },
  rbi_lottery: {
    title: "RBI Cautions about Fictitious Emails",
    publisher: "Reserve Bank of India",
    date: "4 Jul 2018",
    url: "https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=44392",
    used_for: "'Nobody from RBI calls up people about lottery winnings/funds received from abroad'",
  },
  dot_sim_disconnection: {
    title: "DoT advisory on calls threatening mobile disconnection",
    publisher: "Department of Telecommunications (PIB)",
    date: "10 Nov 2023",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=1976274",
    used_for: "'The DoT does not make calls to citizens threatening disconnection'",
  },
  trai_no_payments: {
    title: "TRAI Issues Advisory on Fraudulent Activities Misusing TRAI's Name",
    publisher: "Telecom Regulatory Authority of India (PIB)",
    date: "6 Aug 2025",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2153153",
    used_for: "'No regulatory body conducts investigations or collects payments through phone calls, messaging apps, or video platforms'",
  },
  cert_in_mahila: {
    title: "Mahila Suraksha booklet",
    publisher: "CERT-In, MeitY",
    date: "2025",
    url: "https://www.cert-in.org.in/PDF/Mahila_Suraksha_Booklet25.pdf",
    used_for: "Video-call blackmail: don't take calls from strangers, save evidence, report",
  },
  ncrp: {
    title: "National Cyber Crime Reporting Portal and helpline 1930",
    publisher: "I4C, Ministry of Home Affairs",
    date: "accessed Oct 2026",
    url: "https://cybercrime.gov.in",
    used_for: "'Any victim of financial cyber fraud can dial helpline number 1930'",
  },
  chakshu: {
    title: "Sanchar Saathi: Chakshu",
    publisher: "Department of Telecommunications",
    date: "accessed Oct 2026",
    url: "https://sancharsaathi.gov.in/sfc/",
    used_for: "Reporting suspected fraud calls, SMS and WhatsApp messages (not for money already lost; use 1930)",
  },
} satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

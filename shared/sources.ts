/**
 * Official public sources behind the pattern library. Each entry says what we
 * rely on it for; docs/RESEARCH.md quotes or summarises the relevant part.
 * Accessed October 2026.
 */
export interface Source {
  title: string;
  publisher: string;
  url: string;
  used_for: string;
}

export const SOURCES = {
  pib_digital_arrest: {
    title: "Advisory on 'digital arrest' frauds",
    publisher: "Ministry of Home Affairs / I4C (via PIB)",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2056606",
    used_for: "How digital-arrest frauds work; agencies do not arrest over video calls",
  },
  i4c_cyberdost: {
    title: "Cyber Dost awareness posts",
    publisher: "Indian Cyber Crime Coordination Centre (I4C), MHA",
    url: "https://x.com/Cyberdost",
    used_for: "Pattern-by-pattern public advisories (digital arrest, task, investment, courier, family emergency)",
  },
  mann_ki_baat_oct2024: {
    title: "Mann Ki Baat, 27 October 2024: 'Stop, Think, Take Action'",
    publisher: "Prime Minister's Office (via PIB)",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2068604",
    used_for: "'No government agency threatens you on the phone or asks for money over a video call'",
  },
  ncrp: {
    title: "National Cyber Crime Reporting Portal and helpline 1930",
    publisher: "I4C, Ministry of Home Affairs",
    url: "https://cybercrime.gov.in",
    used_for: "Where to report; 1930 for financial cyber fraud",
  },
  sanchar_saathi_chakshu: {
    title: "Sanchar Saathi: Chakshu (report suspected fraud communication)",
    publisher: "Department of Telecommunications",
    url: "https://sancharsaathi.gov.in/sfc/",
    used_for: "Reporting fraudulent calls, SMS and WhatsApp messages",
  },
  rbi_beaware: {
    title: "BE(A)WARE: a booklet on the modus operandi of financial fraudsters",
    publisher: "Reserve Bank of India",
    url: "https://rbidocs.rbi.org.in/rdocs/content/pdfs/BEAWARE07032022.pdf",
    used_for: "Modus operandi: fake KYC, remote access apps, fake customer care, prize/lottery, OTP/PIN sharing",
  },
  rbi_kehta_hai: {
    title: "RBI Kehta Hai public awareness campaign",
    publisher: "Reserve Bank of India",
    url: "https://rbikehtahai.rbi.org.in/",
    used_for: "Banks and RBI never ask for OTP, PIN or card details",
  },
  npci_upi_safety: {
    title: "UPI safety tips",
    publisher: "National Payments Corporation of India",
    url: "https://www.npci.org.in/what-we-do/upi/upi-safety-tips",
    used_for: "UPI PIN is needed only to send money, never to receive",
  },
  cert_in_advisory: {
    title: "Advisories on online financial fraud and remote access apps",
    publisher: "CERT-In, MeitY",
    url: "https://www.cert-in.org.in/",
    used_for: "Avoid installing remote-access apps on request",
  },
  trai_advisory: {
    title: "TRAI cautions public against calls threatening mobile number disconnection",
    publisher: "Telecom Regulatory Authority of India",
    url: "https://www.trai.gov.in/",
    used_for: "TRAI does not call to disconnect numbers",
  },
} satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

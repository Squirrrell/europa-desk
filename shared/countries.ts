export interface Edition {
  hl: string;
  gl: string;
  ceid: string;
}

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string;
  /** ISO 3166-1 numeric, matches the ids in world-atlas. Missing for Kosovo. */
  numeric?: string;
  name: string;
  /** English Google News search terms. */
  query: string;
  /** Local Google News edition, used for domestic top stories when AI can translate them. */
  edition?: Edition;
}

const ed = (hl: string, gl: string, lang = hl): Edition => ({ hl, gl, ceid: `${gl}:${lang}` });

export const COUNTRIES: Country[] = [
  { code: "AL", numeric: "008", name: "Albania", query: "Albania OR Albanian OR Tirana" },
  { code: "AM", numeric: "051", name: "Armenia", query: "Armenia OR Armenian OR Yerevan" },
  { code: "AT", numeric: "040", name: "Austria", query: "Austria OR Austrian OR Vienna", edition: ed("de", "AT") },
  { code: "AZ", numeric: "031", name: "Azerbaijan", query: "Azerbaijan OR Azerbaijani OR Baku" },
  { code: "BA", numeric: "070", name: "Bosnia and Herzegovina", query: "Bosnia OR Sarajevo OR \"Republika Srpska\"" },
  { code: "BE", numeric: "056", name: "Belgium", query: "Belgium OR Belgian", edition: ed("fr", "BE") },
  { code: "BG", numeric: "100", name: "Bulgaria", query: "Bulgaria OR Bulgarian OR Sofia", edition: ed("bg", "BG") },
  { code: "BY", numeric: "112", name: "Belarus", query: "Belarus OR Belarusian OR Minsk" },
  { code: "CH", numeric: "756", name: "Switzerland", query: "Switzerland OR Swiss", edition: ed("de", "CH") },
  { code: "CY", numeric: "196", name: "Cyprus", query: "Cyprus OR Cypriot OR Nicosia" },
  { code: "CZ", numeric: "203", name: "Czechia", query: "Czech OR Czechia OR Prague", edition: ed("cs", "CZ") },
  { code: "DE", numeric: "276", name: "Germany", query: "Germany OR German OR Berlin OR Bundestag", edition: ed("de", "DE") },
  { code: "DK", numeric: "208", name: "Denmark", query: "Denmark OR Danish OR Copenhagen" },
  { code: "EE", numeric: "233", name: "Estonia", query: "Estonia OR Estonian OR Tallinn" },
  { code: "ES", numeric: "724", name: "Spain", query: "Spain OR Spanish OR Madrid", edition: ed("es", "ES") },
  { code: "FI", numeric: "246", name: "Finland", query: "Finland OR Finnish OR Helsinki" },
  { code: "FR", numeric: "250", name: "France", query: "France OR French OR Paris OR Macron", edition: ed("fr", "FR") },
  { code: "GB", numeric: "826", name: "United Kingdom", query: "UK OR Britain OR British OR Westminster", edition: ed("en-GB", "GB", "en") },
  { code: "GE", numeric: "268", name: "Georgia", query: "Georgia Tbilisi OR \"Georgian Dream\" OR \"Georgian government\"" },
  { code: "GR", numeric: "300", name: "Greece", query: "Greece OR Greek OR Athens", edition: ed("el", "GR") },
  { code: "HR", numeric: "191", name: "Croatia", query: "Croatia OR Croatian OR Zagreb" },
  { code: "HU", numeric: "348", name: "Hungary", query: "Hungary OR Hungarian OR Budapest", edition: ed("hu", "HU") },
  { code: "IE", numeric: "372", name: "Ireland", query: "Ireland OR Irish OR Dublin", edition: ed("en-IE", "IE", "en") },
  { code: "IS", numeric: "352", name: "Iceland", query: "Iceland OR Icelandic OR Reykjavik" },
  { code: "IT", numeric: "380", name: "Italy", query: "Italy OR Italian OR Rome", edition: ed("it", "IT") },
  { code: "LT", numeric: "440", name: "Lithuania", query: "Lithuania OR Lithuanian OR Vilnius", edition: ed("lt", "LT") },
  { code: "LU", numeric: "442", name: "Luxembourg", query: "Luxembourg" },
  { code: "LV", numeric: "428", name: "Latvia", query: "Latvia OR Latvian OR Riga", edition: ed("lv", "LV") },
  { code: "MD", numeric: "498", name: "Moldova", query: "Moldova OR Moldovan OR Chisinau" },
  { code: "ME", numeric: "499", name: "Montenegro", query: "Montenegro OR Montenegrin OR Podgorica" },
  { code: "MK", numeric: "807", name: "North Macedonia", query: "\"North Macedonia\" OR Skopje" },
  { code: "MT", numeric: "470", name: "Malta", query: "Malta OR Maltese OR Valletta" },
  { code: "NL", numeric: "528", name: "Netherlands", query: "Netherlands OR Dutch OR Amsterdam", edition: ed("nl", "NL") },
  { code: "NO", numeric: "578", name: "Norway", query: "Norway OR Norwegian OR Oslo", edition: ed("no", "NO") },
  { code: "PL", numeric: "616", name: "Poland", query: "Poland OR Polish OR Poles OR Warsaw", edition: ed("pl", "PL") },
  { code: "PT", numeric: "620", name: "Portugal", query: "Portugal OR Portuguese OR Lisbon", edition: ed("pt-PT", "PT", "pt-150") },
  { code: "RO", numeric: "642", name: "Romania", query: "Romania OR Romanian OR Bucharest", edition: ed("ro", "RO") },
  { code: "RS", numeric: "688", name: "Serbia", query: "Serbia OR Serbian OR Belgrade", edition: ed("sr", "RS") },
  { code: "RU", numeric: "643", name: "Russia", query: "Russia OR Kremlin OR Moscow", edition: ed("ru", "RU") },
  { code: "SE", numeric: "752", name: "Sweden", query: "Sweden OR Swedish OR Stockholm", edition: ed("sv", "SE") },
  { code: "SI", numeric: "705", name: "Slovenia", query: "Slovenia OR Slovenian OR Ljubljana", edition: ed("sl", "SI") },
  { code: "SK", numeric: "703", name: "Slovakia", query: "Slovakia OR Slovak OR Bratislava", edition: ed("sk", "SK") },
  { code: "TR", numeric: "792", name: "Turkey", query: "Turkey OR Turkish OR Erdogan OR Ankara", edition: ed("tr", "TR") },
  { code: "UA", numeric: "804", name: "Ukraine", query: "Ukraine OR Ukrainian OR Kyiv", edition: ed("uk", "UA") },
  { code: "XK", name: "Kosovo", query: "Kosovo OR Pristina" },
];

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

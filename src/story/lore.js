// The dark side of Goob Co.: goob is made from people.
// Employees picked for "Employee of the Month" get "transferred" to the vats
// in B1. The Mars shipments are where the evidence goes. Dale's briefing
// ("your name came up on the rotation") is not about the delivery.

// The people who went into the vats. They appear on missing-person flyers,
// on the vat room clipboard, and in the files.
export const MISSING = [
  { name: 'Gary Pruitt', dept: 'Accounting', seen: 'Near the B1 stairwell', since: 'March' },
  { name: 'Denise Okafor', dept: 'IT', seen: 'Server room, late shift', since: 'May' },
  { name: 'Phil Hammond', dept: 'Mail Room', seen: 'Loading dock', since: 'June' },
  { name: 'Rosa Delgado', dept: 'Night Cleaning Crew', seen: 'Goob lab', since: 'August' },
  { name: 'Ken Ashby', dept: 'Sales', seen: 'Employee of the Month party', since: 'last month' },
];

// Missing-person flyers taped to walls. person: index into MISSING.
export const FLYERS = [
  { x: 0.12, y: 1.6, z: 15.4, facing: 'e', person: 0 },     // break room
  { x: 9.6, y: 1.55, z: 10.12, facing: 'n', person: 3 },    // 1F corridor
  { x: 6, y: 1.6, z: -0.12, facing: 's', person: 4 },       // outside the front, parking lot
  { x: 8, y: -2.4, z: 12.88, facing: 's', person: 1 },      // B1 hall
  { x: 18.12, y: 5.6, z: 22.2, facing: 'e', person: 2 },    // 2F kitchenette
  { x: 35.85, y: 1.6, z: 3, facing: 'w', person: 0 },      // loading dock east wall
];


// Collectible files, found lying around the building. `kind` sets the look:
// 'folder' (manila), 'paper' (white printout), 'note' (yellow sticky note).
export const FILES = [
  {
    id: 'returned-mail', title: 'Returned mail', kind: 'paper', at: { x: 21.6, y: 0.9, z: 6.5 },
    body: `RETURN TO SENDER\n\nAddressee: PHIL HAMMOND, Goob Co. Mail Room\n\nNo longer at this address.\nForwarding address, stamped in green ink:\n\n    GOOB CO. B1 — VAT 3\n\nSomeone has written underneath in pencil: "Phil IS the mail room. Who stamped this?"`,
  },
  {
    id: 'infirmary-log', title: 'Infirmary visit log', kind: 'folder', at: { x: 22.0, y: 0.9, z: 23.6 },
    body: `INFIRMARY — VISIT LOG (excerpt)\n\n• Night crew: headaches after cleaning B1. Says the vats "hum her name." Rest prescribed.\n• Sales: nausea after his Employee of the Month party. Says the cake "tasted green." Rest prescribed.\n• Night crew (again): reports the humming now knows her address.\n\nNOTE FROM MANAGEMENT: Do not refer staff to B1 for any reason. Do not write down what they say about it.`,
  },
  {
    id: 'sticky-gary', title: 'Sticky note on a table', kind: 'note', at: { x: 3.5, y: 0.76, z: 17.1 },
    body: `Has anyone seen Gary?\n\nHis mug is still in the sink and his lunch is still in the fridge. HR says he "transferred to a new position."\n\nHe didn't say goodbye. Gary says goodbye to the VENDING MACHINE.\n\n— Nell`,
  },
  {
    id: 'hr-memo', title: 'HR memo to Dale', kind: 'folder', at: { x: 0.45, y: 5.3, z: 5.3 },
    body: `TO: Dale, Floor Manager\nFROM: Human Resources\nRE: Your questions about the transfer list\n\nDale,\n\nPlease stop asking where the transferred employees were transferred TO. They were transferred. That is the whole sentence.\n\nThe rotation continues as scheduled. Please keep morale high and keep announcing the winners with the same enthusiasm.\n\nWe appreciate your enthusiasm.`,
  },
  {
    id: 'badge-log', title: 'Badge access printout', kind: 'paper', at: { x: 21.5, y: 4, z: 12.5 },
    body: `BADGE ACCESS REPORT — DOOR: B1 VAT ROOM\n\nG. PRUITT      IN 23:14   OUT —\nD. OKAFOR      IN 02:51   OUT —\nP. HAMMOND     IN 19:02   OUT —\nR. DELGADO     IN 04:40   OUT —\nK. ASHBY       IN 22:37   OUT —\nV. (EXEC)      IN 23:10   OUT 23:58\nV. (EXEC)      IN 02:45   OUT 03:30\n\nAlert: 5 badges entered with no exit recorded. Alert dismissed by: V. (EXEC)`,
  },
  {
    id: 'copier-page', title: 'Page stuck in the copier', kind: 'paper', at: { x: 23.6, y: 4.9, z: 9.8 },
    body: `...batch yield improves markedly with fresh input. Input from the Employee of the Month program shows the highest purity to date. Recommend increasing the award to twice monthly.\n\n[the rest of the page is torn off]\n\nAcross the top, someone has scrawled: "INPUT?? what input"`,
  },
  {
    id: 'lab-log', title: "Dr. Pell's lab log", kind: 'folder', at: { x: 21.2, y: -3.1, z: 16.8 },
    body: `LAB LOG — DR. PELL\n\nDay 1: Batch 7 settled nicely. Good color.\nDay 4: Batch 7 hums at night. Pitch matches no machine in the building.\nDay 9: The hum sounds like Rosa laughing. Rosa from the night crew. I haven't seen Rosa in weeks.\nDay 12: I asked the batch to stop. It said my name.\nDay 13: Requesting a transfer.\nDay 13, later: Request denied. Congratulations on being nominated for Employee of the Month.`,
  },
  {
    id: 'vat-clipboard', title: 'Vat room clipboard', kind: 'folder', at: { x: 17.4, y: -4, z: 17.2 },
    body: `VAT ASSIGNMENTS\n\nVAT 1 — PRUITT, G.     (settled)\nVAT 2 — OKAFOR, D.     (settled)\nVAT 3 — HAMMOND, P.    (settled)\nVAT 4 — DELGADO, R.    (humming — monitor)\nVAT 5 — ASHBY, K.      (new)\nVAT 6 — RESERVED: see this month's rotation\n\nReminder: remove badges and lanyards before input. They clog the filters.`,
  },
  {
    id: 'board-email', title: 'Printed email', kind: 'paper', at: { x: 8.1, y: -3.24, z: 20.25 },
    body: `FROM: Board of Directors\nTO: Victoria (CEO)\nSUBJECT: Mars program — approved\n\nThe board approves the Mars program. Shipments leave quarterly. No returns, no inspections, no questions at the far end.\n\nWhatever the vats can't use goes on the shuttle. Mars has a lot of room.\n\nPlease delete this email.\n\n[Printed by: D. OKAFOR, IT — 02:43]`,
  },
  {
    id: 'personnel', title: 'Employee of the Month criteria', kind: 'folder', at: { x: 6, y: 8, z: 20.3 },
    body: `CONFIDENTIAL — EMPLOYEE OF THE MONTH PROGRAM\n\nSelection criteria:\n  ✓ Reliable\n  ✓ Few close friends at the company\n  ✓ Not likely to be missed quickly\n  ✓ Healthy\n\nThe winner receives a gold plaque and is transferred within 30 days.\n\nPrevious winners: Pruitt, Okafor, Hammond, Delgado, Ashby.\nNext on the rotation: see attached.\n\n[The attachment is a photo of your desk.]`,
  },
  {
    id: 'ceo-letter', title: "Victoria's unsent letter", kind: 'paper', at: { x: 4.1, y: 8.76, z: 4.5 },
    body: `I didn't invent goob. My father found it, the first time a man fell into a vat and the batch came out perfect.\n\nGoob only comes from people. Every jar we sell is somebody. I've made my peace with it. The shareholders have made their peace with it.\n\nI keep the plaques in my desk drawer. Five of them now. I polish them on Fridays.\n\nI will not send this letter.\n\n— V`,
  },
  {
    id: 'napkin', title: 'Napkin on the bar', kind: 'note', at: { x: 23.4, y: 8.9, z: 19.2 },
    body: `Next month's rotation:\n\nThe new kid on 2F. The one Dale calls "champ."\nReliable. Keeps to themselves. Nobody would notice for a week.\n\nOrder the gold plaque.\n\n— V`,
  },
];

// You have to find every file before you can confront Victoria.
export const FILES_NEEDED = FILES.length;

// What Victoria says when you confront her, and the two endings.
export const CONFRONTATION = [
  "Champ. Come in, sit down. You've been reading things that aren't yours.",
  "You want to know where goob comes from. Not a mine. Not a lab. Not Mars.",
  'It comes from people. It always has. Gary. Denise. Phil. Rosa. Ken.',
  "They're still here, in a way. They're in every jar we ship. They're even in the goob you just vacuumed up.",
  "And Mars? Mars is just where we put what's left over.",
  "Dale told you your name came up on the rotation, didn't he? He thought it was about the delivery. Bless him.",
  "So here's your choice, Champ. Walk out that door and tell everyone. Or take a promotion, and forget you read a thing.",
];

export const CHOICES = ['Expose Goob Co.', 'Keep quiet'];

export const ENDINGS = [
  {
    victoria: "Then you'd better run faster than the goob, Champ.",
    title: 'Chapter 1 complete',
    text: 'You got the files out. Goob Co. was shut down, the vats were drained, and five families finally got answers. Victoria was never found.',
  },
  {
    victoria: "Wise. Congratulations, Champ. You're Employee of the Month.",
    title: 'Chapter 1 complete',
    text: 'You kept quiet. You got a corner office and a gold plaque. The next rotation is in thirty days. Your name is still on the list.',
  },
];

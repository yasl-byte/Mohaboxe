/* ============================================================
   MOHABOXE — Données du programme
   Challenge : lundi 5 octobre 2026 → lundi 4 janvier 2027
   ============================================================ */

const PLAN = {
  start: "2026-10-05",
  end: "2027-01-04",
  poidsDepart: 100,
  poidsObjectif: 90,
  taille: 178,
  onDays: [1, 3, 5], // lundi, mercredi, vendredi (0 = dimanche)
  eauVerres: 8,      // 8 verres de 25 cl = 2 L
  cibles: {
    ON:  { kcal: 2400, p: 170, f: 70, c: 270 },
    OFF: { kcal: 2000, p: 170, f: 75, c: 160 }
  }
};

/* ---------- Phases (par semaine du challenge) ---------- */
const PHASES = {
  fondation: {
    nom: "Fondation",
    texte: "On apprend les gestes et on construit la base : charges modérées, technique irréprochable, 2 répétitions en réserve.",
    mult: 1
  },
  force: {
    nom: "Force",
    texte: "Charges plus lourdes, moins de répétitions : on bâtit la force qui nourrira le punch.",
    mult: 1.1
  },
  puissance: {
    nom: "Puissance",
    texte: "Charges lourdes exécutées le plus vite possible : on transforme la force en vitesse et en explosivité.",
    mult: 1.15
  },
  decharge: {
    nom: "Décharge",
    texte: "Semaine allégée : volume réduit, charges à −20 %. C’est là que le corps assimile les progrès. Ne la saute pas !",
    mult: 0.8
  }
};

// semaine 1 à 14 (la 14e = le seul lundi 4 janvier, jour du bilan)
const PHASE_PAR_SEMAINE = {
  1: "fondation", 2: "fondation", 3: "fondation", 4: "decharge",
  5: "force", 6: "force", 7: "force", 8: "decharge",
  9: "puissance", 10: "puissance", 11: "puissance", 12: "puissance",
  13: "decharge", 14: "decharge"
};

/* ---------- Schémas séries × répétitions ---------- */
const SCHEMAS = {
  fondation: { force: "3 × 10", acc: "3 × 12", explo: "3 × 6", pdc: "3 × max", carry: "3 × 30 m", iso: "2 × 15 s par direction" },
  force:     { force: "4 × 6",  acc: "3 × 10", explo: "4 × 5", pdc: "4 × max", carry: "4 × 30 m", iso: "3 × 20 s par direction" },
  puissance: { force: "4 × 5 (montée explosive)", acc: "3 × 8", explo: "5 × 4 (vitesse max)", pdc: "4 × max, rapide", carry: "4 × 40 m", iso: "3 × 25 s par direction" },
  decharge:  { force: "2 × 8",  acc: "2 × 10", explo: "2 × 5", pdc: "2 × max", carry: "2 × 30 m", iso: "2 × 15 s par direction" }
};
const REPOS = { force: 120, acc: 75, explo: 90, pdc: 75, carry: 90, iso: 45 };

/* ---------- Exercices de musculation ---------- */
const EXOS = {
  // Séance A
  squat: { nom: "Squat à la barre", cible: "Quadriceps, fessiers : le socle du punch", type: "force", unit: "kg", base: 40, step: 2.5,
    conseil: "Descends cuisses parallèles, dos neutre, pousse le sol avec tout le pied.", yt: "squat barre technique" },
  rdl: { nom: "Soulevé de terre roumain (haltères)", cible: "Ischios, fessiers, bas du dos", type: "force", unit: "kg", note: "par haltère", base: 16, step: 2,
    conseil: "Hanches vers l’arrière, haltères qui frôlent les cuisses, dos bien plat.", yt: "soulevé de terre roumain haltères" },
  bulgare: { nom: "Fentes bulgares (haltères)", cible: "Jambes une à une : équilibre et appuis", type: "acc", unit: "kg", note: "par haltère", base: 8, step: 2,
    conseil: "Pied arrière sur le banc, buste droit, genou avant dans l’axe du pied.", yt: "fente bulgare haltères" },
  boxjump: { nom: "Sauts sur box (bas)", cible: "Explosivité des jambes", type: "explo", unit: "cm", note: "hauteur de la box", base: 30, step: 0,
    conseil: "Saute haut, atterris sans bruit, redescends en marchant (jamais en sautant).", yt: "box jump débutant technique" },
  pallof: { nom: "Pallof press à la poulie", cible: "Gainage anti-rotation : un tronc qui encaisse", type: "acc", unit: "kg", base: 10, step: 2.5,
    conseil: "Bras tendus devant toi, ne laisse jamais la poulie te faire tourner.", yt: "pallof press poulie" },
  mollets: { nom: "Mollets debout (machine)", cible: "Mollets : rester léger sur l’avant du pied", type: "acc", unit: "kg", base: 40, step: 5,
    conseil: "Monte le plus haut possible, pause d’une seconde, descends lentement.", yt: "extension mollets debout machine" },

  // Séance B
  dc: { nom: "Développé couché (haltères)", cible: "Pectoraux, triceps : la chaîne du direct", type: "force", unit: "kg", note: "par haltère", base: 18, step: 2,
    conseil: "Omoplates serrées, coudes à 45°, descends contrôlé et pousse fort.", yt: "développé couché haltères technique" },
  militaire: { nom: "Développé militaire assis (haltères)", cible: "Épaules : tenir la garde haute", type: "force", unit: "kg", note: "par haltère", base: 12, step: 2,
    conseil: "Abdos serrés, pas de cambrure, pousse à la verticale au-dessus de la tête.", yt: "développé militaire haltères assis" },
  woodchop: { nom: "Woodchop à la poulie", cible: "Obliques : la rotation qui arme les crochets", type: "acc", unit: "kg", base: 10, step: 2.5,
    conseil: "Le mouvement part des pieds et des hanches, pas des bras.", yt: "woodchop poulie" },
  medball: { nom: "Lancer rotatif de medicine-ball au mur", cible: "Puissance de rotation, vitesse des coups", type: "explo", unit: "kg", base: 4, step: 0,
    conseil: "Pivote le pied arrière comme sur un crochet et lance de toutes tes forces.", yt: "lancer medicine ball rotation mur" },
  pompes: { nom: "Pompes", cible: "Pectoraux, triceps, gainage", type: "pdc", unit: "reps", base: 10, step: 1,
    conseil: "Corps gainé comme une planche, poitrine jusqu’au sol, remonte vite.", yt: "pompes technique parfaite" },
  releves: { nom: "Relevés de genoux suspendu", cible: "Abdos : encaisser au corps", type: "pdc", unit: "reps", base: 8, step: 1,
    conseil: "Aucun élan : remonte les genoux et enroule le bassin.", yt: "relevé de genoux suspendu barre" },

  // Séance C
  tirage: { nom: "Tirage vertical poitrine", cible: "Dos : stabilité et retour de bras rapide", type: "force", unit: "kg", base: 45, step: 2.5,
    conseil: "Tire vers le haut de la poitrine, coudes vers le bas, buste fier.", yt: "tirage vertical poitrine technique" },
  rowing: { nom: "Rowing haltère un bras", cible: "Dos, arrière d’épaule", type: "force", unit: "kg", note: "par haltère", base: 20, step: 2,
    conseil: "Dos plat, tire le coude vers la hanche, sans tourner le buste.", yt: "rowing haltère un bras" },
  facepull: { nom: "Face pull à la corde", cible: "Arrière d’épaule : des épaules solides", type: "acc", unit: "kg", base: 15, step: 2.5,
    conseil: "Tire vers le front en écartant la corde, pouces vers l’arrière.", yt: "face pull corde poulie" },
  rotext: { nom: "Rotation externe à la poulie", cible: "Coiffe des rotateurs : prévenir les blessures", type: "acc", unit: "kg", base: 4, step: 1,
    conseil: "Coude collé au corps, charge légère, mouvement lent et contrôlé.", yt: "rotation externe épaule poulie" },
  farmer: { nom: "Marche du fermier (haltères)", cible: "Poigne, trapèzes, gainage", type: "carry", unit: "kg", note: "par haltère", base: 20, step: 2,
    conseil: "Épaules basses, buste droit, petits pas rapides.", yt: "farmer walk marche du fermier" },
  nuque: { nom: "Isométrie de la nuque (4 directions)", cible: "Cou : mieux encaisser les coups", type: "iso", unit: "s", base: 15, step: 0,
    conseil: "Main contre la tête, résiste sans bouger, poussée douce et progressive.", yt: "renforcement nuque isométrique" }
};

/* ---------- Séances ---------- */
const SEANCES = {
  A: {
    titre: "Jambes & explosivité",
    description: "Les coups naissent du sol : squat, chaîne postérieure, appuis sur une jambe et sauts, pour des jambes puissantes et un tronc qui transmet la force.",
    exos: ["squat", "rdl", "bulgare", "boxjump", "pallof", "mollets"],
    echauffement: [
      "5 min de vélo ou de rameur, rythme tranquille",
      "10 cercles de hanches et 10 cercles de chevilles de chaque côté",
      "10 squats au poids du corps + 10 fentes alternées",
      "1 à 2 séries légères de squat avant la charge de travail"
    ],
    etirements: [
      "Quadriceps debout : 30 s par jambe",
      "Ischios, jambe tendue sur un banc : 30 s par jambe",
      "Fléchisseurs de hanche en fente basse : 30 s par côté",
      "Mollets contre un mur : 30 s par jambe"
    ]
  },
  B: {
    titre: "Poussée & rotation",
    description: "La chaîne du direct et du crochet : pectoraux, épaules, rotation du tronc et vitesse d’exécution.",
    exos: ["dc", "militaire", "woodchop", "medball", "pompes", "releves"],
    echauffement: [
      "5 min de rameur, rythme tranquille",
      "Grands cercles de bras : 10 vers l’avant, 10 vers l’arrière",
      "10 rotations du buste de chaque côté, bras croisés",
      "15 face pulls très légers pour réveiller les épaules",
      "1 série légère de développé couché"
    ],
    etirements: [
      "Pectoraux dans l’encadrement d’une porte : 30 s par côté",
      "Épaule, bras tendu croisé devant la poitrine : 30 s par côté",
      "Triceps, coude derrière la tête : 30 s par côté",
      "Torsion du buste allongé au sol : 30 s par côté"
    ]
  },
  C: {
    titre: "Tirage & blindage",
    description: "Dos, épaules solides, poigne et nuque : tout ce qui protège le boxeur et ramène la garde au visage.",
    exos: ["tirage", "rowing", "facepull", "rotext", "farmer", "nuque"],
    echauffement: [
      "5 min de corde à sauter légère ou de rameur",
      "10 rotations d’épaules et 10 rotations de la tête, lentement",
      "10 dos rond / dos creux à quatre pattes",
      "20 s suspendu à la barre, bras tendus",
      "1 série légère de tirage vertical"
    ],
    etirements: [
      "Grand dorsal, mains sur un banc, buste vers le sol : 30 s",
      "Trapèzes et nuque, oreille vers l’épaule, très doucement : 20 s par côté",
      "Avant-bras, paume tirée vers soi : 20 s par main",
      "Posture de l’enfant : 45 s en respirant profondément"
    ]
  }
};

/* ---------- Exercices de boxe ---------- */
// progression : liste de { dès: semaine, r: rounds, w: secondes de travail, rest: secondes de repos }
const BOXE = {
  corde: {
    nom: "Corde à sauter",
    desc: "Le cardio du boxeur : rythme, coordination et pieds légers.",
    conseil: "Petits sauts sur l’avant du pied, ce sont les poignets qui font tourner la corde.",
    yt: "corde à sauter boxe débutant",
    prog: [ { des: 1, r: 4, w: 45, rest: 45 }, { des: 3, r: 4, w: 60, rest: 60 }, { des: 5, r: 3, w: 120, rest: 60 },
            { des: 7, r: 4, w: 120, rest: 60 }, { des: 9, r: 3, w: 180, rest: 60 }, { des: 11, r: 4, w: 180, rest: 60 } ]
  },
  shadow: {
    nom: "Shadow boxing",
    desc: "Boxer dans le vide face à un adversaire imaginaire, garde toujours haute.",
    conseil: "Expire à chaque coup et reviens en garde aussi vite que tu frappes.",
    yt: "shadow boxing débutant anglaise",
    prog: [ { des: 1, r: 3, w: 120, rest: 60 }, { des: 5, r: 3, w: 180, rest: 60 }, { des: 9, r: 4, w: 180, rest: 60 } ]
  },
  footwork: {
    nom: "Jeu de jambes",
    desc: "Pas chassés avant, arrière et latéraux, puis pivots sur le pied avant.",
    conseil: "Ne croise jamais les pieds et garde toujours la même distance entre eux.",
    yt: "jeu de jambes boxe exercices",
    prog: [ { des: 1, r: 3, w: 60, rest: 60 }, { des: 5, r: 3, w: 90, rest: 45 }, { des: 9, r: 4, w: 90, rest: 45 } ]
  },
  equilibre: {
    nom: "Équilibre en garde",
    desc: "Sur une jambe, en garde, lance des jabs lents sans poser l’autre pied. Alterne les jambes à chaque round.",
    conseil: "Regarde droit devant, abdos serrés ; dès la semaine 7, essaie les yeux fermés.",
    yt: "exercice équilibre boxe une jambe",
    prog: [ { des: 1, r: 6, w: 30, rest: 10 }, { des: 5, r: 6, w: 40, rest: 10 }, { des: 9, r: 6, w: 45, rest: 10 } ]
  },
  esquives: {
    nom: "Esquives sous la corde",
    desc: "Tends une corde ou un élastique à hauteur d’épaule et avance en roulant dessous, en zigzag.",
    conseil: "Plie les jambes, pas le dos : les yeux restent toujours sur l’adversaire.",
    yt: "slip and roll boxe corde esquive",
    prog: [ { des: 1, r: 3, w: 60, rest: 60 }, { des: 5, r: 3, w: 90, rest: 60 } ]
  },
  reflexes: {
    nom: "Réflexes à la balle",
    desc: "Lance une balle de tennis contre un mur et rattrape-la de l’autre main, en position de garde.",
    conseil: "Rapproche-toi du mur au fil des semaines pour réduire le temps de réaction.",
    yt: "exercice réflexes balle tennis mur boxe",
    prog: [ { des: 1, r: 3, w: 60, rest: 30 }, { des: 7, r: 4, w: 60, rest: 30 } ]
  },
  vitesse: {
    nom: "Vitesse de mains (tabata)",
    desc: "Rafales de directs à fond pendant 20 s, 10 s de repos, 8 fois. Poings serrés à l’impact seulement.",
    conseil: "Vitesse et relâchement : un bras détendu frappe plus vite qu’un bras crispé.",
    yt: "tabata boxe vitesse directs",
    prog: [ { des: 1, r: 6, w: 20, rest: 10 }, { des: 5, r: 8, w: 20, rest: 10 } ]
  }
};

// Thème du shadow boxing selon la semaine
const THEMES_SHADOW = [
  "Jab et direct (1-2) avec déplacements",
  "Travail de la garde : chaque coup revient au visage",
  "Crochets (3-4) et pivots",
  "Esquives puis contre-attaque",
  "Uppercuts (5-6) et changements de niveau",
  "Enchaînements libres de 3 à 5 coups"
];

// Jours ON : 2 exercices « intenses » après la muscu (ou plus tard dans la journée)
const BOXE_ON = { A: ["corde", "footwork"], B: ["corde", "vitesse"], C: ["corde", "shadow"] };

// Jours OFF : boxe douce, 3 exercices à 50 % de l’intensité, en rotation
const BOXE_OFF = [
  ["shadow", "equilibre", "reflexes"],
  ["footwork", "esquives", "equilibre"],
  ["shadow", "esquives", "reflexes"],
  ["footwork", "shadow", "equilibre"],
  ["reflexes", "esquives", "footwork"]
];

const ECHAUFFEMENT_BOXE = [
  "1 min de rotations articulaires : nuque, épaules, poignets, hanches, chevilles",
  "1 min de sautillements sur place, épaules relâchées"
];

/* ---------- Base d’aliments courants (valeurs pour 100 g) ---------- */
const ALIMENTS = [
  { nom: "Blanc de poulet (cru)", kcal: 110, p: 23, c: 0, f: 1.5 },
  { nom: "Blanc de dinde (cru)", kcal: 105, p: 24, c: 0, f: 1 },
  { nom: "Steak haché 5 % (cru)", kcal: 125, p: 21, c: 0, f: 5 },
  { nom: "Saumon (cru)", kcal: 200, p: 20, c: 0, f: 13 },
  { nom: "Thon au naturel (égoutté)", kcal: 110, p: 25, c: 0, f: 1 },
  { nom: "Jambon blanc", kcal: 110, p: 20, c: 1, f: 3 },
  { nom: "Œuf entier (≈ 60 g l’unité)", kcal: 143, p: 12.6, c: 0.7, f: 9.5, portion: 60 },
  { nom: "Blanc d’œuf", kcal: 52, p: 11, c: 0.7, f: 0.2 },
  { nom: "Skyr nature", kcal: 63, p: 11, c: 4, f: 0.2 },
  { nom: "Fromage blanc 0 %", kcal: 50, p: 8, c: 4, f: 0.1 },
  { nom: "Cottage cheese", kcal: 98, p: 11, c: 3.4, f: 4.3 },
  { nom: "Lait demi-écrémé", kcal: 46, p: 3.3, c: 4.8, f: 1.6 },
  { nom: "Whey (dose ≈ 30 g)", kcal: 380, p: 78, c: 6, f: 5, portion: 30 },
  { nom: "Fromage (gouda)", kcal: 356, p: 25, c: 0, f: 27 },
  { nom: "Riz basmati (cru)", kcal: 355, p: 8, c: 78, f: 0.8 },
  { nom: "Riz (cuit)", kcal: 130, p: 2.7, c: 28, f: 0.3 },
  { nom: "Pâtes (crues)", kcal: 355, p: 12.5, c: 72, f: 1.5 },
  { nom: "Pâtes (cuites)", kcal: 158, p: 5.8, c: 31, f: 0.9 },
  { nom: "Pommes de terre (cuites à l’eau)", kcal: 86, p: 1.9, c: 19, f: 0.1 },
  { nom: "Patate douce (cuite)", kcal: 90, p: 2, c: 20.7, f: 0.2 },
  { nom: "Flocons d’avoine", kcal: 370, p: 13.5, c: 60, f: 7 },
  { nom: "Pain complet", kcal: 247, p: 13, c: 41, f: 3.4 },
  { nom: "Lentilles (cuites)", kcal: 116, p: 9, c: 17, f: 0.4 },
  { nom: "Banane", kcal: 89, p: 1.1, c: 23, f: 0.3, portion: 120 },
  { nom: "Pomme", kcal: 52, p: 0.3, c: 14, f: 0.2, portion: 150 },
  { nom: "Brocoli", kcal: 34, p: 2.8, c: 4, f: 0.4 },
  { nom: "Haricots verts", kcal: 31, p: 1.8, c: 4, f: 0.2 },
  { nom: "Avocat", kcal: 160, p: 2, c: 2, f: 15 },
  { nom: "Amandes", kcal: 600, p: 21, c: 8, f: 51 },
  { nom: "Beurre de cacahuète", kcal: 590, p: 25, c: 16, f: 50 },
  { nom: "Huile d’olive", kcal: 884, p: 0, c: 0, f: 100 },
  { nom: "Frites (friterie)", kcal: 300, p: 3.5, c: 36, f: 15 }
];

/* ---------- Le saviez-vous ? ---------- */
const FAITS = [
  // Histoire
  { cat: "Histoire", txt: "Les règles du marquis de Queensberry, publiées en 1867, ont imposé les gants, les rounds de 3 minutes et le compte jusqu’à 10. Elles fondent la boxe anglaise moderne." },
  { cat: "Histoire", txt: "Le pugilat figurait déjà aux Jeux olympiques antiques : il y fit son entrée en 688 avant J.-C." },
  { cat: "Histoire", txt: "En 1743, le champion anglais Jack Broughton rédigea les premières règles écrites de la boxe, notamment pour protéger les combattants tombés au sol." },
  { cat: "Histoire", txt: "La boxe est entrée aux Jeux olympiques modernes en 1904, à Saint-Louis. Elle en fut absente en 1912, car la Suède, pays hôte, l’interdisait." },
  { cat: "Histoire", txt: "Le « ring » est carré, mais il doit son nom aux cercles que les spectateurs formaient autrefois autour des combattants." },
  { cat: "Histoire", txt: "En 1889, John L. Sullivan et Jake Kilrain se sont affrontés à mains nues pendant 75 rounds, l’un des derniers grands combats de l’ère sans gants." },
  { cat: "Histoire", txt: "En 1892, James J. Corbett battit John L. Sullivan pour le premier championnat du monde des poids lourds disputé avec des gants selon les règles de Queensberry." },
  { cat: "Histoire", txt: "La boxe féminine n’a fait son entrée aux Jeux olympiques qu’en 2012, à Londres." },
  { cat: "Histoire", txt: "En 1921, le combat Jack Dempsey – Georges Carpentier fut le premier de l’histoire à rapporter plus d’un million de dollars de recettes." },
  { cat: "Histoire", txt: "En 1976, le Belge Jean-Pierre Coopman, surnommé « le Lion des Flandres », affronta Mohamed Ali pour le titre mondial des poids lourds à Porto Rico." },
  { cat: "Histoire", txt: "Le « Rumble in the Jungle » s’est tenu à Kinshasa en 1974 : Mohamed Ali y reprit le titre à George Foreman en l’épuisant contre les cordes." },
  { cat: "Histoire", txt: "Le « Thrilla in Manila » (1975) fut le troisième et le plus terrible des combats entre Mohamed Ali et Joe Frazier." },
  { cat: "Histoire", txt: "Depuis 2013, les boxeurs amateurs masculins de l’élite combattent sans casque, décision jugée plus sûre car elle réduirait certaines commotions." },

  // Champions
  { cat: "Champions", txt: "Mohamed Ali, né Cassius Clay, fut champion olympique des mi-lourds à Rome en 1960, à 18 ans." },
  { cat: "Champions", txt: "Rocky Marciano est le seul champion du monde des poids lourds à avoir pris sa retraite invaincu, avec 49 victoires en 49 combats." },
  { cat: "Champions", txt: "Floyd Mayweather Jr. a terminé sa carrière avec un palmarès parfait de 50 victoires sans défaite." },
  { cat: "Champions", txt: "Mike Tyson est devenu champion du monde des poids lourds en 1986, à 20 ans : le plus jeune de l’histoire." },
  { cat: "Champions", txt: "En 1994, George Foreman reconquit le titre des poids lourds à 45 ans, vingt ans après l’avoir perdu contre Ali." },
  { cat: "Champions", txt: "Sugar Ray Robinson, aux plus de 170 victoires, est souvent cité comme le meilleur boxeur « livre pour livre » de tous les temps." },
  { cat: "Champions", txt: "Joe Louis a défendu son titre des poids lourds 25 fois et l’a conservé près de douze ans." },
  { cat: "Champions", txt: "Jack Johnson devint en 1908 le premier champion du monde noir des poids lourds, en battant Tommy Burns à Sydney." },
  { cat: "Champions", txt: "Le Français Marcel Cerdan fut sacré champion du monde des poids moyens en 1948. Il périt l’année suivante dans un accident d’avion aux Açores." },
  { cat: "Champions", txt: "Le Sénégalais Battling Siki devint en 1922 le premier champion du monde africain, en battant Georges Carpentier à Paris." },
  { cat: "Champions", txt: "Manny Pacquiao est le seul boxeur à avoir remporté des titres mondiaux dans huit catégories de poids différentes." },
  { cat: "Champions", txt: "Vasyl Lomachenko a remporté un titre mondial dès son troisième combat professionnel, égalant un record historique." },
  { cat: "Champions", txt: "Julio César Chávez a enchaîné plus de 85 combats professionnels sans défaite avant son premier revers, en 1994." },
  { cat: "Champions", txt: "Wladimir Klitschko a régné sur les poids lourds pendant près de neuf ans et demi, de 2006 à 2015. Son frère Vitali, docteur en sciences du sport, est devenu maire de Kyiv." },
  { cat: "Champions", txt: "La Belge Delfine Persoon a été championne du monde WBC des poids légers pendant plusieurs années." },
  { cat: "Champions", txt: "Le Français Brahim Asloum a été sacré champion olympique des mi-mouches aux Jeux de Sydney, en 2000." },
  { cat: "Champions", txt: "Aux Jeux de Rio 2016, Tony Yoka (super-lourds) et Estelle Mossely (légers) ont tous deux décroché l’or olympique pour la France." },
  { cat: "Champions", txt: "La Britannique Nicola Adams est devenue en 2012 la toute première championne olympique de boxe de l’histoire." },

  // Boxe / entraînement
  { cat: "Boxe", txt: "La puissance d’un direct vient surtout des jambes et de la rotation des hanches : le bras ne fait que transmettre la force venue du sol." },
  { cat: "Boxe", txt: "Le jab est, de loin, le coup le plus lancé dans un combat : il sert à mesurer la distance, à gêner l’adversaire et à préparer les autres coups." },
  { cat: "Boxe", txt: "Les entraîneurs numérotent les coups : 1 jab, 2 direct, 3 crochet avant, 4 crochet arrière, 5 uppercut avant, 6 uppercut arrière." },
  { cat: "Boxe", txt: "Expirer brièvement à chaque coup gaine le tronc, protège en cas de contre et évite de bloquer sa respiration." },
  { cat: "Boxe", txt: "En boxe olympique, un combat se dispute en 3 rounds de 3 minutes ; chez les professionnels, un championnat du monde masculin compte 12 rounds." },
  { cat: "Boxe", txt: "Chez les professionnelles, les rounds durent en général 2 minutes, contre 3 minutes chez les hommes." },
  { cat: "Boxe", txt: "La corde à sauter est l’exercice fétiche des boxeurs : elle développe le rythme, l’endurance et la légèreté des appuis." },
  { cat: "Boxe", txt: "Les bandes de boxe maintiennent le poignet et les petits os de la main : ne frappe jamais un sac sans elles." },
  { cat: "Boxe", txt: "En déplacement, un boxeur ne croise jamais les pieds : croiser, c’est perdre son équilibre au moment où l’adversaire attaque." },
  { cat: "Boxe", txt: "Les boxeurs renforcent leur nuque parce qu’un cou solide aide à mieux amortir les coups reçus à la tête." },
  { cat: "Boxe", txt: "« Vole comme un papillon, pique comme une abeille » : la formule célèbre de Mohamed Ali venait de son fidèle assistant, Drew Bundini Brown." },
  { cat: "Boxe", txt: "Le shadow boxing est pratiqué par tous les champions : sans adversaire, on peut se concentrer entièrement sur la technique et la garde." },
  { cat: "Boxe", txt: "Un bras relâché frappe plus vite qu’un bras crispé : les boxeurs ne serrent le poing qu’au moment de l’impact." },
  { cat: "Boxe", txt: "Le sommeil fait partie de l’entraînement : c’est pendant la nuit que les muscles se réparent et que les gestes appris s’ancrent." },

  // Alimentation
  { cat: "Alimentation", txt: "Un gramme de protéines ou de glucides apporte environ 4 kcal, un gramme de lipides 9 kcal, et un gramme d’alcool 7 kcal." },
  { cat: "Alimentation", txt: "Digérer des protéines coûte de l’énergie : 20 à 30 % de leurs calories sont dépensées rien que pour les assimiler." },
  { cat: "Alimentation", txt: "Perdre environ 2 % de son poids en eau suffit à faire baisser les performances sportives." },
  { cat: "Alimentation", txt: "Le poids varie de 1 à 2 kg d’un jour à l’autre selon l’eau, le sel et les glucides stockés : c’est la tendance sur une semaine qui compte." },
  { cat: "Alimentation", txt: "Chaque gramme de glycogène stocké dans les muscles retient environ 3 grammes d’eau. D’où la chute rapide sur la balance les premiers jours d’un régime." },
  { cat: "Alimentation", txt: "Une canette de cola de 33 cl contient environ 35 g de sucre, soit l’équivalent de 7 morceaux." },
  { cat: "Alimentation", txt: "Une grande portion de frites de friterie (≈ 200 g) dépasse facilement 500 kcal." },
  { cat: "Alimentation", txt: "Un œuf apporte environ 6 à 7 g de protéines de très bonne qualité, pour à peine 80 kcal." },
  { cat: "Alimentation", txt: "Les fibres rassasient et régulent la digestion : il est conseillé d’en consommer 25 à 30 g par jour (légumes, fruits, céréales complètes, légumineuses)." },
  { cat: "Alimentation", txt: "Un repas riche en glucides pris 2 à 3 heures avant l’entraînement donne l’énergie nécessaire pour des rounds intenses." },
  { cat: "Alimentation", txt: "Le manque de sommeil dérègle les hormones de la faim : après une courte nuit, on a tendance à manger davantage." },
  { cat: "Alimentation", txt: "Le skyr contient environ 10 à 11 g de protéines pour 100 g : une collation idéale pour un boxeur au régime." },
  { cat: "Alimentation", txt: "Les calories bues ne rassasient presque pas : jus, sodas et alcool s’additionnent sans calmer l’appétit." },
  { cat: "Alimentation", txt: "Sur une étiquette, compare toujours les valeurs « pour 100 g » : c’est le seul moyen de comparer deux produits honnêtement." }
];

/* ---------- Points & grades ---------- */
const GRADES = [
  { min: 0, nom: "Espoir" },
  { min: 400, nom: "Amateur" },
  { min: 1200, nom: "Challenger" },
  { min: 2500, nom: "Prétendant" },
  { min: 4500, nom: "Champion" },
  { min: 7000, nom: "Légende" }
];

const BAREME = {
  echauffement: 5, etirements: 5, exoLog: 5, seance: 50, record: 20,
  boxeExo: 10, boxeComplet: 15, eau: 10, kcalCible: 15, proteines: 10, pesee: 5, trophee: 50
};

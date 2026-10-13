import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';

export type Gender = 'male' | 'female' | 'all' | 'unknown';

// Curated list of common Indian, international, and cross-cultural male first names
const MALE_NAMES = new Set([
  'aarav', 'aaron', 'abhishek', 'adam', 'aditya', 'agastya', 'ahmed', 'ajay', 'akash', 'alok', 'aman', 'amar',
  'amit', 'amrit', 'anand', 'andrew', 'aniket', 'ankit', 'ankush', 'anshul', 'anthony', 'anuj', 'anurag',
  'arjun', 'arnav', 'arthur', 'arun', 'arvind', 'aryan', 'ashish', 'ashok', 'ashwin', 'austin', 'avanish',
  'aviral', 'ayush', 'ayushman', 'bappa', 'benjamin', 'bharat', 'bhargav', 'bhavin', 'bhavesh', 'bhuvan',
  'brian', 'bruce', 'carl', 'chaitanya', 'charles', 'chetan', 'chirag', 'chris', 'christian', 'christopher',
  'daniel', 'darshan', 'david', 'deep', 'deepak', 'dennis', 'dev', 'devansh', 'devendra', 'devesh', 'dhairya',
  'dharmesh', 'dhiraj', 'dhruv', 'digvijay', 'dinesh', 'divyansh', 'divyesh', 'donald', 'douglas', 'dylan',
  'edward', 'elijah', 'eric', 'ethan', 'ezra', 'farhan', 'frank', 'gabriel', 'ganesh', 'gary', 'gaurav',
  'gautam', 'george', 'gopal', 'gregory', 'hardik', 'hari', 'harish', 'harsh', 'harshad', 'harshit', 'henry',
  'hiren', 'hitesh', 'hrithik', 'ian', 'ibrahim', 'ishan', 'ishwar', 'jack', 'jacob', 'jagdish', 'james',
  'jason', 'jatin', 'jay', 'jayant', 'jayesh', 'jeffrey', 'jeremy', 'jerry', 'jignesh', 'jimmy', 'jitendra',
  'joe', 'john', 'jonathan', 'jordan', 'jose', 'joseph', 'joshua', 'justin', 'kailash', 'kamal', 'kapil',
  'karan', 'kartik', 'keith', 'keshav', 'kevin', 'kishore', 'krish', 'krishna', 'krunal', 'kuldeep', 'kumar',
  'kunal', 'kush', 'kushagra', 'kyle', 'laksh', 'lakshay', 'larry', 'logan', 'louis', 'lucas', 'madhav',
  'mahesh', 'manan', 'manav', 'manish', 'manoj', 'mark', 'mason', 'matthew', 'mayank', 'mayur', 'michael',
  'mihir', 'milan', 'mithun', 'mohammed', 'mohit', 'mukesh', 'mustafa', 'nakul', 'naman', 'naresh', 'nathan',
  'naveen', 'navneet', 'neel', 'neil', 'nicholas', 'nihal', 'nikhil', 'nilesh', 'nimish', 'nishant', 'nitesh',
  'nitin', 'noah', 'om', 'omkar', 'pankaj', 'paras', 'parikshit', 'parth', 'parthesh', 'patrick', 'paul',
  'pawan', 'peter', 'philip', 'piyush', 'pradeep', 'prakash', 'pranav', 'pranay', 'prasad', 'prashant',
  'prateek', 'pratik', 'praveen', 'prem', 'pritom', 'priyansh', 'priyanshu', 'raghav', 'rahul', 'raj',
  'rajan', 'rajat', 'rajeev', 'rajendra', 'rajesh', 'rakesh', 'ram', 'rama', 'ramesh', 'rana', 'ranbeer',
  'ranbir', 'ranveer', 'ranvijay', 'rashid', 'ravi', 'ravindra', 'raymond', 'richard', 'rishi', 'rishabh',
  'ritesh', 'rithvik', 'robert', 'robin', 'rohan', 'rohit', 'ronak', 'ronald', 'ronit', 'rudra', 'rupam',
  'rushabh', 'rushil', 'russell', 'ryan', 'sachin', 'sagar', 'sahil', 'sam', 'samarth', 'sameer', 'samir',
  'samuel', 'sandeep', 'sanjay', 'sanjeev', 'sanket', 'sarvesh', 'satish', 'saurabh', 'scott', 'sean',
  'shailesh', 'shankara', 'sharad', 'shashank', 'shashi', 'shaurya', 'shivam', 'shiv', 'shiva', 'shrey',
  'shreyas', 'shubham', 'siddhant', 'siddharth', 'soham', 'somesh', 'sparsh', 'stephen', 'steven', 'subhash',
  'sudhanshu', 'sudhir', 'sujit', 'sumit', 'sunder', 'sunil', 'suraj', 'suresh', 'surya', 'swapnil', 'tanmay',
  'tapan', 'tarun', 'tejas', 'thomas', 'timothy', 'tirth', 'todd', 'tushar', 'tyler', 'uday', 'umang',
  'umesh', 'utkarsh', 'utsav', 'vaibhav', 'varun', 'ved', 'vedant', 'veer', 'victor', 'vijay', 'vikas',
  'vikram', 'vikrant', 'vinay', 'vincent', 'vinit', 'vipul', 'virendra', 'virat', 'vishal', 'vishesh',
  'vishnu', 'vishwas', 'vivek', 'walter', 'william', 'yash', 'yashraj', 'yatin', 'yogesh', 'yug', 'yuvraj',
  'zachary', 'zayd'
]);

// Curated list of common Indian, international, and cross-cultural female first names
const FEMALE_NAMES = new Set([
  'aanya', 'aaratrika', 'aarti', 'aarushi', 'aashi', 'aashna', 'aavya', 'abigail', 'aditi', 'afreen',
  'aiswarya', 'aishwarya', 'aisha', 'akanksha', 'akshara', 'akshita', 'alankrita', 'alexa', 'alia', 'alisha',
  'alyssa', 'amanda', 'amber', 'amrita', 'amy', 'anamika', 'ananya', 'andrea', 'angela', 'anjali', 'anjana',
  'ankita', 'ann', 'anna', 'annette', 'annika', 'anshika', 'anugraha', 'anupama', 'anuradha', 'anushka',
  'anushree', 'anwita', 'aparna', 'archana', 'arohi', 'arti', 'aruna', 'arushi', 'arya', 'ashley', 'asma',
  'asmi', 'avani', 'avantika', 'avni', 'ayesha', 'ayushi', 'barbara', 'barkha', 'beena', 'bhagya', 'bhagyashree',
  'bhakti', 'bhavana', 'bhavini', 'bhavna', 'bhoomi', 'bhumi', 'bianca', 'bina', 'brinda', 'catherine',
  'chahat', 'chaitali', 'chameli', 'chandana', 'chandani', 'chandni', 'chaya', 'chetna', 'chhavi', 'chitra',
  'christina', 'damini', 'daniela', 'darshana', 'debashree', 'deepa', 'deepali', 'deepika', 'deepshikha',
  'deepti', 'devanshi', 'devika', 'dharini', 'dharti', 'dhruvi', 'dimple', 'disha', 'dishita', 'divya',
  'divyana', 'divyanshi', 'diya', 'dolly', 'drishti', 'durga', 'ekta', 'elena', 'elizabeth', 'emily',
  'emma', 'esha', 'eshani', 'eva', 'fatima', 'falguni', 'farah', 'gargi', 'garima', 'gautami', 'gayatri',
  'geeta', 'geetanjali', 'geeti', 'gini', 'gita', 'gitika', 'grace', 'gunjan', 'hannah', 'hansika', 'harini',
  'harshita', 'harshitha', 'heena', 'hema', 'hemangi', 'hemanshi', 'hetal', 'himani', 'hina', 'hiral',
  'hiya', 'honey', 'huma', 'indira', 'indu', 'ipsa', 'ipsita', 'ira', 'irani', 'isabella', 'isha',
  'ishani', 'ishika', 'ishita', 'isita', 'jagriti', 'jahnvi', 'janki', 'janvi', 'jasmine', 'jaya',
  'jayashree', 'jeenal', 'jeetu', 'jennifer', 'jessica', 'jharna', 'jheel', 'jinal', 'jisha', 'jiya',
  'joshita', 'juhi', 'jyoti', 'jyotsna', 'kadambari', 'kajal', 'kalpana', 'kalyani', 'kamini', 'kanika',
  'kanta', 'kanupriya', 'karina', 'karishma', 'kashish', 'katherine', 'katrina', 'kavita', 'kavya', 'keerthi',
  'keshi', 'khushi', 'kiara', 'kimberly', 'kiran', 'kirti', 'kishori', 'komal', 'krina', 'krisha', 'krishnaa',
  'kriti', 'kritika', 'krupali', 'kuhuk', 'kumud', 'kuntal', 'kusum', 'lakshmi', 'lalita', 'laura',
  'lavanya', 'leela', 'leena', 'lekha', 'limca', 'lipi', 'lipika', 'lisa', 'lochan', 'madhavi', 'madhu',
  'madhulika', 'madhuri', 'mahek', 'mahi', 'mahima', 'maina', 'maithili', 'malati', 'malini', 'mallika',
  'mamta', 'manali', 'manasi', 'mandira', 'manisha', 'manju', 'manjula', 'manjusha', 'mannat', 'manorama',
  'mansi', 'margaret', 'maria', 'mary', 'matangi', 'maushmi', 'mitali', 'mayuri', 'medha', 'meena',
  'meenakshi', 'meera', 'megha', 'meghna', 'mehak', 'melissa', 'menaka', 'michelle', 'mini', 'mira',
  'mohana', 'mohini', 'mona', 'monika', 'mridula', 'mrunal', 'mukta', 'muskan', 'myra',
  'naina', 'nalini', 'namita', 'namrata', 'nandana', 'nandini', 'nandita', 'naomi', 'narmada', 'natasha',
  'navya', 'nayana', 'neelam', 'neelu', 'neeraja', 'neeta', 'neetu', 'neha', 'netra', 'nidha',
  'nidhi', 'niharika', 'nikita', 'nilam', 'nilima', 'nimisha', 'nirmala', 'nirupama', 'nisha', 'nishita',
  'nistha', 'niti', 'nitya', 'nupur', 'nutan', 'olivia', 'padma', 'padmavati', 'palak', 'pallavi',
  'pamela', 'panchali', 'paridhi', 'parineeti', 'parita', 'parmeet', 'padmini', 'parul', 'parvati', 'parveen',
  'payal', 'payelia', 'pinki', 'pinky', 'pihu', 'pooja', 'poonam', 'poorva', 'prachi', 'pragati',
  'pragya', 'pranali', 'pranati', 'prarthana', 'prashasti', 'pratibha', 'pratima', 'pratyusha', 'preeti',
  'preity', 'prerna', 'priya', 'priyadarshini', 'priyanka', 'pujita', 'punam', 'purnima', 'purva', 'purvi',
  'rachana', 'rachita', 'radha', 'radhika', 'ragini', 'raisa', 'rajani', 'rajashree', 'rajeshwari', 'rajni',
  'rakhi', 'raksha', 'ramya', 'rani', 'ranjana', 'rashmi', 'rashi', 'ratna', 'raveena', 'reema',
  'rena', 'renu', 'renuka', 'reshma', 'revathi', 'rhea', 'richa', 'riddhi', 'rimi', 'rinkal',
  'rinki', 'rita', 'ritika', 'ritu', 'riya', 'rohani', 'rohini', 'roma', 'roopa',
  'roopali', 'roshni', 'ruchika', 'ruchi', 'ruchira', 'ruhi', 'rupa', 'rupali', 'saachi', 'sabina',
  'sadhana', 'sakshi', 'saloni', 'samaira', 'samanvi', 'sameera', 'samiksha', 'sampriti', 'samriddhi', 'samyukta',
  'sana', 'sanaya', 'sanchita', 'sandhya', 'sangita', 'sanjana', 'sanjivani', 'sanya', 'sapna', 'sara',
  'sarah', 'sarala', 'sarika', 'sarita', 'saroj', 'sarojini', 'saryu', 'sasha', 'sasmita', 'satya',
  'saumya', 'savita', 'savitri', 'sayali', 'sayani', 'seema', 'shabana', 'shailaja', 'shaili', 'shalini',
  'shalmali', 'shambhavi', 'shanta', 'sharanya', 'sharda', 'sharmila', 'shashikala', 'shazia', 'sheetal',
  'shefali', 'shikha', 'shilpa', 'shilpi', 'shirley', 'shital', 'shivangi', 'shivani', 'shobha', 'shobhana',
  'shradha', 'shraddha', 'shravani', 'shreya', 'shreyashi', 'shri', 'shristi', 'shriti', 'shruti', 'shubhangi',
  'shubhra', 'shuchi', 'shweta', 'siddhi', 'simran', 'simi', 'siya', 'smita', 'smriti', 'sneha',
  'snehal', 'snigdha', 'sofiya', 'sohini', 'somya', 'sonal', 'sonali', 'sonam', 'sonia', 'sonika',
  'soniya', 'sophia', 'spandana', 'spriha', 'sravani', 'srishti', 'stephanie', 'subhadra', 'sucharita', 'suchitra',
  'sudha', 'sugandha', 'suhani', 'sujata', 'sukanya', 'sukriti', 'sulabha', 'sulochana', 'suman', 'sumati',
  'sumitra', 'sunaina', 'sunanda', 'sunidhi', 'sunita', 'suparna', 'supriya', 'surabhi', 'surbhi',
  'sushila', 'sushma', 'sushmita', 'suvarna', 'swapna', 'swara', 'swarnali', 'swarna', 'swati', 'sweta',
  'tabassum', 'tamanna', 'tanaya', 'tanisha', 'tanu', 'tanuja', 'tanvi', 'tanya', 'tapasya', 'tara',
  'tarini', 'tarla', 'taruna', 'teesta', 'tejal', 'tina', 'tiya', 'trisha', 'trupti', 'tulsi',
  'twinkle', 'uma', 'unmesh', 'upasana', 'urja', 'urmi', 'urmila', 'urvashi', 'urvi', 'ushma',
  'usha', 'ushashi', 'vaibhavi', 'vaidehi', 'vaishali', 'vaishnavi', 'vandana', 'vanshika', 'varsha', 'vasudha',
  'vasundhara', 'veda', 'vedika', 'vibha', 'vibhuti', 'vidhi', 'vidisha', 'vidya', 'vijaya', 'vimla',
  'vinita', 'vrinda', 'vritti', 'yamini', 'yashasvi', 'yashvi', 'yashoda', 'yasmin', 'yukti', 'yuvika',
  'zara', 'zenab', 'zoya'
]);

/**
 * Determines gender from a user's full or first name.
 */
export function detectGender(fullName: string | null | undefined): Gender {
  if (!fullName || typeof fullName !== 'string') return 'unknown';
  const clean = fullName.trim().toLowerCase();
  if (!clean) return 'unknown';

  const firstName = clean.split(/[\s._-]+/)[0].replace(/[^a-z]/g, '');
  if (!firstName || firstName.length < 2) return 'unknown';

  if (FEMALE_NAMES.has(firstName)) return 'female';
  if (MALE_NAMES.has(firstName)) return 'male';

  // Rule-based exceptions for male names ending in 'a'
  const maleAExceptions = [
    'krishna', 'shiva', 'surya', 'rama', 'rana', 'bappa', 'mustafa', 'murtaza',
    'hamza', 'joshua', 'ezra', 'luca', 'noah', 'elija', 'shankara', 'rudra', 'indra', 'chaitanya'
  ];
  if (maleAExceptions.some((ex) => firstName === ex || firstName.endsWith(ex))) return 'male';

  // Rule-based exceptions for male names ending in 'i'
  const maleIExceptions = ['ravi', 'hari', 'ali', 'rishi', 'mani', 'shani', 'giri', 'kashi'];
  if (maleIExceptions.some((ex) => firstName === ex)) return 'male';

  // Female suffixes
  if (
    firstName.endsWith('a') ||
    firstName.endsWith('i') ||
    firstName.endsWith('ee') ||
    firstName.endsWith('ya') ||
    firstName.endsWith('na') ||
    firstName.endsWith('ta') ||
    firstName.endsWith('ti') ||
    firstName.endsWith('ika') ||
    firstName.endsWith('ita') ||
    firstName.endsWith('sha') ||
    firstName.endsWith('shi') ||
    firstName.endsWith('vi') ||
    firstName.endsWith('shree') ||
    firstName.endsWith('vanti') ||
    firstName.endsWith('mati') ||
    firstName.endsWith('ka') ||
    firstName.endsWith('lyn') ||
    firstName.endsWith('line') ||
    firstName.endsWith('elle') ||
    firstName.endsWith('ette')
  ) {
    return 'female';
  }

  // Male suffixes
  if (
    firstName.endsWith('esh') ||
    firstName.endsWith('raj') ||
    firstName.endsWith('deep') ||
    firstName.endsWith('veer') ||
    firstName.endsWith('endra') ||
    firstName.endsWith('inder') ||
    firstName.endsWith('jeet') ||
    firstName.endsWith('meet') ||
    firstName.endsWith('pal') ||
    firstName.endsWith('kumar') ||
    firstName.endsWith('singh') ||
    firstName.endsWith('an') ||
    firstName.endsWith('am') ||
    firstName.endsWith('ur') ||
    firstName.endsWith('ar') ||
    firstName.endsWith('al') ||
    firstName.endsWith('ul') ||
    firstName.endsWith('in') ||
    firstName.endsWith('it') ||
    firstName.endsWith('at') ||
    firstName.endsWith('th') ||
    firstName.endsWith('sh') ||
    firstName.endsWith('v')
  ) {
    return 'male';
  }

  return 'unknown';
}


// Lorelei Short / Masculine hair styles
export const LORELEI_MALE_HAIR: any[] = [
  'variant02', 'variant04', 'variant05', 'variant07', 'variant09', 'variant12',
  'variant17', 'variant20', 'variant22', 'variant24', 'variant25', 'variant26',
  'variant28', 'variant29', 'variant34', 'variant35', 'variant36', 'variant37',
  'variant38', 'variant39', 'variant43', 'variant44', 'variant47'
];

// Lorelei Medium/Long / Feminine hair styles
export const LORELEI_FEMALE_HAIR: any[] = [
  'variant01', 'variant06', 'variant08', 'variant10', 'variant11', 'variant13',
  'variant14', 'variant15', 'variant16', 'variant18', 'variant19', 'variant21',
  'variant23', 'variant27', 'variant30', 'variant31', 'variant32', 'variant33',
  'variant40', 'variant41', 'variant42', 'variant45', 'variant46', 'variant48'
];

/**
 * Returns Dicebear Lorelei avatar options tailored for gender and random seed.
 * Note: 'all' / 'unknown' allows full, unconstrained freedom across all styles.
 */
export function getGenderMatchedAvatarOptions(gender: Gender, seed: string) {
  if (gender === 'female') {
    return {
      seed,
      hair: LORELEI_FEMALE_HAIR,
      beard: [] as any[],
      beardProbability: 0,
      hairAccessoriesProbability: 25,
      earringsProbability: 35,
      glassesProbability: 15,
      backgroundColor: ['FDFBF7', 'F5F0E6']
    };
  }

  if (gender === 'male') {
    return {
      seed,
      hair: LORELEI_MALE_HAIR,
      beard: ['variant01', 'variant02'] as any[],
      beardProbability: 30,
      hairAccessoriesProbability: 0,
      earringsProbability: 0,
      glassesProbability: 15,
      backgroundColor: ['FDFBF7', 'F5F0E6']
    };
  }

  // 'all' / 'unknown' - Completely unrestricted, anyone can get any avatar
  return {
    seed,
    backgroundColor: ['FDFBF7', 'F5F0E6']
  };
}

/**
 * Generates an SVG Data URI using Dicebear Lorelei and gender rules.
 */
export function generateDicebearAvatar(options: {
  seed: string;
  gender?: Gender;
  size?: number;
}): string {
  const gender = options.gender || 'unknown';
  const customOptions = getGenderMatchedAvatarOptions(gender, options.seed);

  return createAvatar(lorelei, {
    size: options.size || 128,
    radius: 0,
    ...customOptions
  }).toDataUri();
}

/**
 * Generates a direct Dicebear CDN URL using query parameters.
 * Prioritized for high-speed, lightweight avatar delivery.
 */
export function generateDicebearAvatarUrl(options: {
  seed: string;
  gender?: Gender;
  size?: number;
}): string {
  const gender = options.gender || 'unknown';
  const customOptions = getGenderMatchedAvatarOptions(gender, options.seed);
  const params = new URLSearchParams();

  params.set('seed', customOptions.seed);
  params.set('backgroundColor', customOptions.backgroundColor.join(','));

  if ('hair' in customOptions && Array.isArray(customOptions.hair) && customOptions.hair.length > 0) {
    params.set('hair', customOptions.hair.join(','));
  }

  if ('beard' in customOptions && Array.isArray(customOptions.beard) && customOptions.beard.length > 0) {
    params.set('beard', customOptions.beard.join(','));
  }

  if ('beardProbability' in customOptions && typeof customOptions.beardProbability === 'number') {
    params.set('beardProbability', String(customOptions.beardProbability));
  }

  if ('hairAccessoriesProbability' in customOptions && typeof customOptions.hairAccessoriesProbability === 'number') {
    params.set('hairAccessoriesProbability', String(customOptions.hairAccessoriesProbability));
  }

  if ('earringsProbability' in customOptions && typeof customOptions.earringsProbability === 'number') {
    params.set('earringsProbability', String(customOptions.earringsProbability));
  }

  if ('glassesProbability' in customOptions && typeof customOptions.glassesProbability === 'number') {
    params.set('glassesProbability', String(customOptions.glassesProbability));
  }

  if (options.size) {
    params.set('size', String(options.size));
  }

  return `https://api.dicebear.com/9.x/lorelei/svg?${params.toString()}`;
}

/**
 * Parses any incoming inline profile picture data URI (Base64, UTF-8 SVG, or raw encoded data)
 * into a safe Buffer and metadata for storage upload.
 */
export function parseProfilePictureDataUri(dataUri: string): {
  buffer: Buffer;
  mimeType: string;
  extension: string;
} | null {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:image')) {
    return null;
  }

  try {
    const mimeTypeMatch = dataUri.match(/data:(.*?);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

    let buffer: Buffer;
    if (dataUri.includes(';base64,')) {
      const base64Data = dataUri.split(';base64,')[1];
      if (!base64Data) return null;
      buffer = Buffer.from(base64Data, 'base64');
    } else if (dataUri.includes('utf8,')) {
      const rawData = decodeURIComponent(dataUri.split('utf8,')[1]);
      buffer = Buffer.from(rawData, 'utf-8');
    } else {
      const commaIndex = dataUri.indexOf(',');
      if (commaIndex === -1) return null;
      const rawData = decodeURIComponent(dataUri.slice(commaIndex + 1));
      buffer = Buffer.from(rawData, 'utf-8');
    }

    let extension = 'jpg';
    if (mimeType.includes('svg')) extension = 'svg';
    else if (mimeType.includes('png')) extension = 'png';
    else if (mimeType.includes('webp')) extension = 'webp';

    return { buffer, mimeType, extension };
  } catch (err) {
    console.error('Failed to parse profile picture data URI:', err);
    return null;
  }
}

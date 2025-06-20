import { logger } from '../index';

/**
 * Supported languages for the voice AI system
 */
export enum SupportedLanguage {
  ENGLISH = 'english',
  HINDI = 'hindi',
  TAMIL = 'tamil',
  TELUGU = 'telugu',
  BENGALI = 'bengali',
  MARATHI = 'marathi',
  PUNJABI = 'punjabi',
  GUJARATI = 'gujarati'
}

/**
 * Language detection confidence threshold
 */
export const LANGUAGE_DETECTION_THRESHOLD = 0.7;

/**
 * Configuration for Indian language support
 */
export interface LanguageConfig {
  code: string;
  name: string;
  deepgramModel: string;
  deepgramTier: string;
  elevenLabsVoiceId?: string;
  googleVoiceId?: string;
  isEnabled: boolean;
  timeZone: string;
  regionalAccents?: string[];
  commonPhrases: {
    greeting: string[];
    confirmation: string[];
    farewell: string[];
    objectionHandling: string[];
    clarification: string[];
  };
  // TRAI compliance phrases
  complianceDisclosures: {
    callRecording: string;
    aiDisclosure: string;
    marketingDisclosure: string;
    doNotCall: string;
  };
}

/**
 * Regional language configurations for Indian market optimization
 */
export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  [SupportedLanguage.ENGLISH]: {
    code: 'en-IN',
    name: 'Indian English',
    deepgramModel: 'nova-2',
    deepgramTier: 'enhanced',
    elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB', // Replace with actual voice ID
    isEnabled: true,
    timeZone: 'Asia/Kolkata',
    regionalAccents: ['North Indian', 'South Indian', 'East Indian', 'West Indian'],
    commonPhrases: {
      greeting: [
        'Hello, how are you today?',
        'Good morning! How may I help you?',
        'Namaste, thank you for your time today.'
      ],
      confirmation: [
        'I understand, thank you for sharing that.',
        'That makes sense, let me note that down.',
        'Thank you for confirming.'
      ],
      farewell: [
        'Thank you for your time today. Have a great day!',
        'It was nice speaking with you. Goodbye!',
        'Thank you for the conversation. Take care!'
      ],
      objectionHandling: [
        'I understand your concern. Let me address that...',
        "That's a valid point. Here's how we can help...",
        'I appreciate your perspective. May I suggest...'
      ],
      clarification: [
        'Could you please clarify what you mean by that?',
        'I want to make sure I understand correctly. Are you saying...?',
        'Would you mind explaining that in a bit more detail?'
      ]
    },
    complianceDisclosures: {
      callRecording: 'This call is being recorded for quality and training purposes.',
      aiDisclosure: 'I am an AI assistant helping with your inquiry today.',
      marketingDisclosure: 'This is a marketing call from [Company Name].',
      doNotCall: 'If you wish to be added to our do-not-call registry, please let me know.'
    }
  },
  [SupportedLanguage.HINDI]: {
    code: 'hi-IN',
    name: 'Hindi',
    deepgramModel: 'nova-2',
    deepgramTier: 'enhanced',
    elevenLabsVoiceId: 'jsCqWAovK2LkecY7zXl4', // Replace with actual voice ID
    isEnabled: true,
    timeZone: 'Asia/Kolkata',
    commonPhrases: {
      greeting: [
        'नमस्ते, आज आप कैसे हैं?',
        'शुभ प्रभात! मैं आपकी कैसे मदद कर सकता हूँ?',
        'नमस्कार, आज आपका समय देने के लिए धन्यवाद।'
      ],
      confirmation: [
        'मैं समझता हूँ, आपके साथ साझा करने के लिए धन्यवाद।',
        'वह समझ में आता है, मुझे इसे नोट करने दें।',
        'पुष्टि करने के लिए धन्यवाद।'
      ],
      farewell: [
        'आज आपके समय के लिए धन्यवाद। आपका दिन शुभ हो!',
        'आपसे बात करके अच्छा लगा। अलविदा!',
        'बातचीत के लिए धन्यवाद। अपना ख्याल रखना!'
      ],
      objectionHandling: [
        'मैं आपकी चिंता समझता हूँ। मुझे इसका समाधान करने दें...',
        'यह एक वैध बिंदु है। हम इस प्रकार मदद कर सकते हैं...',
        'मैं आपके दृष्टिकोण की सराहना करता हूँ। क्या मैं सुझाव दे सकता हूँ...'
      ],
      clarification: [
        'क्या आप कृपया स्पष्ट कर सकते हैं कि आपका क्या मतलब है?',
        'मैं सुनिश्चित करना चाहता हूँ कि मैं सही ढंग से समझ रहा हूँ। क्या आप कह रहे हैं...?',
        'क्या आप थोड़े और विस्तार से समझा सकते हैं?'
      ]
    },
    complianceDisclosures: {
      callRecording: 'यह कॉल गुणवत्ता और प्रशिक्षण उद्देश्यों के लिए रिकॉर्ड किया जा रहा है।',
      aiDisclosure: 'मैं आज आपकी पूछताछ में मदद करने वाला एआई सहायक हूँ।',
      marketingDisclosure: 'यह [कंपनी का नाम] से एक मार्केटिंग कॉल है।',
      doNotCall: 'अगर आप हमारे डू-नॉट-कॉल रजिस्ट्री में जोड़े जाना चाहते हैं, तो कृपया मुझे बताएं।'
    }
  },
  [SupportedLanguage.TAMIL]: {
    code: 'ta-IN',
    name: 'Tamil',
    deepgramModel: 'nova-2',
    deepgramTier: 'enhanced',
    isEnabled: true,
    timeZone: 'Asia/Kolkata',
    commonPhrases: {
      greeting: [
        'வணக்கம், இன்று நீங்கள் எப்படி இருக்கிறீர்கள்?',
        'காலை வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?',
        'வணக்கம், இன்று உங்கள் நேரத்திற்கு நன்றி.'
      ],
      confirmation: [
        'நான் புரிந்து கொள்கிறேன், பகிர்ந்ததற்கு நன்றி.',
        'அது புரிகிறது, நான் அதைக் குறித்துக் கொள்கிறேன்.',
        'உறுதிப்படுத்தியதற்கு நன்றி.'
      ],
      farewell: [
        'இன்று உங்கள் நேரத்திற்கு நன்றி. நல்ல நாளாக இருக்கட்டும்!',
        'உங்களுடன் பேசுவது நன்றாக இருந்தது. வணக்கம்!',
        'உரையாடலுக்கு நன்றி. கவனமாக இருங்கள்!'
      ],
      objectionHandling: [
        'உங்கள் கவலையை நான் புரிந்து கொள்கிறேன். நான் அதைக் கவனிக்கிறேன்...',
        'அது ஒரு சரியான புள்ளி. இவ்வாறு உதவலாம்...',
        'உங்கள் கண்ணோட்டத்தை நான் பாராட்டுகிறேன். நான் பரிந்துரைக்கலாமா...'
      ],
      clarification: [
        'நீங்கள் என்ன அர்த்தம் என்று தெளிவுபடுத்த முடியுமா?',
        'நான் சரியாகப் புரிந்து கொள்ள விரும்புகிறேன். நீங்கள் சொல்வது...',
        'கொஞ்சம் கூடுதல் விவரங்களை விளக்க முடியுமா?'
      ]
    },
    complianceDisclosures: {
      callRecording: 'இந்த அழைப்பு தரம் மற்றும் பயிற்சி நோக்கங்களுக்காக பதிவு செய்யப்படுகிறது.',
      aiDisclosure: 'நான் உங்கள் விசாரணையில் உதவும் AI உதவியாளர்.',
      marketingDisclosure: 'இது [நிறுவனத்தின் பெயர்] இலிருந்து ஒரு சந்தைப்படுத்தல் அழைப்பு.',
      doNotCall: 'நீங்கள் எங்கள் அழைக்க வேண்டாம் பதிவில் சேர்க்கப்பட விரும்பினால், தயவுசெய்து எனக்குத் தெரிவிக்கவும்.'
    }
  },
  [SupportedLanguage.TELUGU]: {
    code: 'te-IN',
    name: 'Telugu',
    deepgramModel: 'nova-2',
    deepgramTier: 'enhanced',
    isEnabled: true,
    timeZone: 'Asia/Kolkata',
    commonPhrases: {
      greeting: [
        'నమస్కారం, ఈరోజు మీరు ఎలా ఉన్నారు?',
        'శుభోదయం! నేను మీకు ఎలా సహాయం చేయగలను?',
        'నమస్తే, ఈరోజు మీ సమయానికి ధన్యవాదాలు.'
      ],
      confirmation: [
        'నేను అర్థం చేసుకున్నాను, పంచుకున్నందుకు ధన్యవాదాలు.',
        'అది అర్థమైంది, నేను దానిని గమనించలేను.',
        'నిర్ధారించినందుకు ధన్యవాదాలు.'
      ],
      farewell: [
        'ఈరోజు మీ సమయానికి ధన్యవాదాలు. మీకు మంచి రోజు గడవాలని కోరుకుంటున్నాను!',
        'మీతో మాట్లాడటం బాగుంది. వీడ్కోలు!',
        'సంభాషణకు ధన్యవాదాలు. జాగ్రత్తగా ఉండండి!'
      ],
      objectionHandling: [
        'మీ ఆందోళన నాకు అర్థమైంది. నేను దానిని పరిష్కరిస్తాను...',
        'అది చెల్లుబాటు అయ్యే పాయింట్. మేము ఇలా సహాయం చేయగలము...',
        'మీ దృక్కోణాన్ని నేను అభినందిస్తున్నాను. నేను సూచించవచ్చా...'
      ],
      clarification: [
        'మీరు దేనిని ఉద్దేశిస్తున్నారో స్పష్టం చేయగలరా?',
        'నేను సరిగ్గా అర్థం చేసుకోవాలనుకుంటున్నాను. మీరు చెప్పేది...',
        'మీరు దాన్ని కొంచెం మరింత వివరంగా వివరించగలరా?'
      ]
    },
    complianceDisclosures: {
      callRecording: 'ఈ కాల్ నాణ్యత మరియు శిక్షణ ప్రయోజనాల కోసం రికార్డ్ చేయబడుతోంది.',
      aiDisclosure: 'నేను మీ విచారణకు సహాయం చేసే AI సహాయకుడిని.',
      marketingDisclosure: 'ఇది [కంపెనీ పేరు] నుండి మార్కెటింగ్ కాల్.',
      doNotCall: 'మీరు మా డు-నాట్-కాల్ రిజిస్ట్రీకి జోడించబడాలనుకుంటే, దయచేసి నాకు తెలియజేయండి.'
    }
  },
  [SupportedLanguage.BENGALI]: {
    code: 'bn-IN',
    name: 'Bengali',
    deepgramModel: 'nova-2',
    deepgramTier: 'enhanced',
    isEnabled: true,
    timeZone: 'Asia/Kolkata',
    commonPhrases: {
      greeting: [
        'নমস্কার, আজ আপনি কেমন আছেন?',
        'শুভ সকাল! আমি কিভাবে আপনাকে সাহায্য করতে পারি?',
        'নমস্কার, আজ আপনার সময় দেওয়ার জন্য ধন্যবাদ।'
      ],
      confirmation: [
        'আমি বুঝতে পারছি, শেয়ার করার জন্য ধন্যবাদ।',
        'এটা বোধগম্য, আমাকে এটা নোট করতে দিন।',
        'নিশ্চিত করার জন্য ধন্যবাদ।'
      ],
      farewell: [
        'আজ আপনার সময়ের জন্য ধন্যবাদ। আপনার দিনটি শুভ হোক!',
        'আপনার সাথে কথা বলে ভালো লাগলো। বিদায়!',
        'কথোপকথনের জন্য ধন্যবাদ। যত্ন নিন!'
      ],
      objectionHandling: [
        'আমি আপনার উদ্বেগ বুঝতে পারছি। আমাকে এটা সমাধান করতে দিন...',
        'এটা একটি বৈধ পয়েন্ট। আমরা এভাবে সাহায্য করতে পারি...',
        'আমি আপনার দৃষ্টিকোণ সম্প্রশংসা করি। আমি কি পরামর্শ দিতে পারি...'
      ],
      clarification: [
        'আপনি কি দয়া করে আপনার অর্থ স্পষ্ট করতে পারেন?',
        'আমি নিশ্চিত করতে চাই যে আমি সঠিকভাবে বুঝতে পারছি। আপনি কি বলছেন...',
        'আপনি কি একটু বিস্তারিতভাবে ব্যাখ্যা করতে পারেন?'
      ]
    },
    complianceDisclosures: {
      callRecording: 'এই কলটি গুণমান ও প্রশিক্ষণের উদ্দেশ্যে রেকর্ড করা হচ্ছে।',
      aiDisclosure: 'আমি আজ আপনার অনুসন্ধানে সাহায্য করার জন্য একটি AI সহকারী।',
      marketingDisclosure: 'এটি [কোম্পানির নাম] থেকে একটি মার্কেটিং কল।',
      doNotCall: 'আপনি যদি আমাদের ডু-নট-কল রেজিস্ট্রিতে যোগ করতে চান, অনুগ্রহ করে আমাকে জানান।'
    }
  },
  [SupportedLanguage.MARATHI]: {
    code: 'mr-IN',
    name: 'Marathi',
    deepgramModel: 'nova-2',
    deepgramTier: 'enhanced',
    isEnabled: true,
    timeZone: 'Asia/Kolkata',
    commonPhrases: {
      greeting: [
        'नमस्कार, आज आपण कसे आहात?',
        'सुप्रभात! मी आपली कशी मदत करू शकतो?',
        'नमस्ते, आज आपल्या वेळेसाठी धन्यवाद.'
      ],
      confirmation: [
        'मला समजले, सामायिक केल्याबद्दल धन्यवाद.',
        'ते समजते, मला ते नोंद करू द्या.',
        'पुष्टी केल्याबद्दल धन्यवाद.'
      ],
      farewell: [
        'आज आपल्या वेळेसाठी धन्यवाद. आपला दिवस चांगला जावो!',
        'आपल्याशी बोलून छान वाटले. निरोप!',
        'संभाषणासाठी धन्यवाद. काळजी घ्या!'
      ],
      objectionHandling: [
        'मला आपली चिंता समजते. मला त्याचे निराकरण करू द्या...',
        'हा एक वैध मुद्दा आहे. आम्ही अशा प्रकारे मदत करू शकतो...',
        'मी आपल्या दृष्टीकोनाची प्रशंसा करतो. मी सुचवू शकतो का...'
      ],
      clarification: [
        'आपण कृपया स्पष्ट करू शकता की आपला अर्थ काय आहे?',
        'मला खात्री करून घ्यायची आहे की मी योग्य प्रकारे समजतो आहे. आपण म्हणत आहात...',
        'आपण ते थोड्या अधिक तपशीलात समजावून सांगू शकता का?'
      ]
    },
    complianceDisclosures: {
      callRecording: 'गुणवत्ता आणि प्रशिक्षण उद्देशांसाठी हा कॉल रेकॉर्ड केला जात आहे.',
      aiDisclosure: 'मी आज आपल्या चौकशीत मदत करणारा AI सहाय्यक आहे.',
      marketingDisclosure: 'हा [कंपनीचे नाव] कडून मार्केटिंग कॉल आहे.',
      doNotCall: 'आपण आमच्या डू-नॉट-कॉल रजिस्ट्रीमध्ये जोडले जाऊ इच्छित असल्यास, कृपया मला सांगा.'
    }
  },
  [SupportedLanguage.PUNJABI]: {
    code: 'pa-IN',
    name: 'Punjabi',
    deepgramModel: 'nova-2',
    deepgramTier: 'enhanced',
    isEnabled: true,
    timeZone: 'Asia/Kolkata',
    commonPhrases: {
      greeting: [
        'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਅੱਜ ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?',
        'ਸ਼ੁਭ ਸਵੇਰ! ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?',
        'ਨਮਸਤੇ, ਅੱਜ ਆਪਣਾ ਸਮਾਂ ਦੇਣ ਲਈ ਧੰਨਵਾਦ।'
      ],
      confirmation: [
        'ਮੈਂ ਸਮਝਦਾ ਹਾਂ, ਸਾਂਝਾ ਕਰਨ ਲਈ ਧੰਨਵਾਦ।',
        'ਇਹ ਸਮਝ ਵਿੱਚ ਆਉਂਦਾ ਹੈ, ਮੈਨੂੰ ਇਸ ਨੂੰ ਨੋਟ ਕਰਨ ਦਿਓ।',
        'ਪੁਸ਼ਟੀ ਕਰਨ ਲਈ ਧੰਨਵਾਦ।'
      ],
      farewell: [
        'ਅੱਜ ਤੁਹਾਡੇ ਸਮੇਂ ਲਈ ਧੰਨਵਾਦ। ਤੁਹਾਡਾ ਦਿਨ ਚੰਗਾ ਬਿਤੇ!',
        'ਤੁਹਾਡੇ ਨਾਲ ਗੱਲ ਕਰਕੇ ਚੰਗਾ ਲੱਗਾ। ਫਿਰ ਮਿਲਾਂਗੇ!',
        'ਗੱਲਬਾਤ ਲਈ ਧੰਨਵਾਦ। ਆਪਣਾ ਖਿਆਲ ਰੱਖਣਾ!'
      ],
      objectionHandling: [
        'ਮੈਂ ਤੁਹਾਡੀ ਚਿੰਤਾ ਨੂੰ ਸਮਝਦਾ ਹਾਂ। ਮੈਨੂੰ ਇਸ ਨੂੰ ਹੱਲ ਕਰਨ ਦਿਓ...',
        'ਇਹ ਇੱਕ ਜਾਇਜ਼ ਮੁੱਦਾ ਹੈ। ਅਸੀਂ ਇਸ ਤਰ੍ਹਾਂ ਮਦਦ ਕਰ ਸਕਦੇ ਹਾਂ...',
        'ਮੈਂ ਤੁਹਾਡੇ ਨਜ਼ਰੀਏ ਦੀ ਸਰਾਹਨਾ ਕਰਦਾ ਹਾਂ। ਕੀ ਮੈਂ ਸੁਝਾਅ ਦੇ ਸਕਦਾ ਹਾਂ...'
      ],
      clarification: [
        'ਕੀ ਤੁਸੀਂ ਕਿਰਪਾ ਕਰਕੇ ਸਪੱਸ਼ਟ ਕਰ ਸਕਦੇ ਹੋ ਕਿ ਤੁਹਾਡਾ ਕੀ ਮਤਲਬ ਹੈ?',
        'ਮੈਂ ਇਹ ਯਕੀਨੀ ਬਣਾਉਣਾ ਚਾਹੁੰਦਾ ਹਾਂ ਕਿ ਮੈਂ ਸਹੀ ਢੰਗ ਨਾਲ ਸਮਝ ਰਿਹਾ ਹਾਂ। ਕੀ ਤੁਸੀਂ ਕਹਿ ਰਹੇ ਹੋ...',
        'ਕੀ ਤੁਸੀਂ ਇਸ ਨੂੰ ਥੋੜਾ ਹੋਰ ਵੇਰਵੇ ਨਾਲ ਸਮਝਾ ਸਕਦੇ ਹੋ?'
      ]
    },
    complianceDisclosures: {
      callRecording: 'ਇਹ ਕਾਲ ਕੁਆਲਿਟੀ ਅਤੇ ਸਿਖਲਾਈ ਦੇ ਉਦੇਸ਼ਾਂ ਲਈ ਰਿਕਾਰਡ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ।',
      aiDisclosure: 'ਮੈਂ ਅੱਜ ਤੁਹਾਡੀ ਪੁੱਛਗਿੱਛ ਵਿੱਚ ਸਹਾਇਤਾ ਕਰਨ ਵਾਲਾ AI ਸਹਾਇਕ ਹਾਂ।',
      marketingDisclosure: 'ਇਹ [ਕੰਪਨੀ ਦਾ ਨਾਮ] ਤੋਂ ਇੱਕ ਮਾਰਕੀਟਿੰਗ ਕਾਲ ਹੈ।',
      doNotCall: 'ਜੇ ਤੁਸੀਂ ਸਾਡੇ ਡੂ-ਨਾਟ-ਕਾਲ ਰਜਿਸਟਰੀ ਵਿੱਚ ਸ਼ਾਮਲ ਕੀਤੇ ਜਾਣਾ ਚਾਹੁੰਦੇ ਹੋ, ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਮੈਨੂੰ ਦੱਸੋ।'
    }
  },
  [SupportedLanguage.GUJARATI]: {
    code: 'gu-IN',
    name: 'Gujarati',
    deepgramModel: 'nova-2',
    deepgramTier: 'enhanced',
    isEnabled: true,
    timeZone: 'Asia/Kolkata',
    commonPhrases: {
      greeting: [
        'નમસ્તે, આજે તમે કેમ છો?',
        'સુપ્રભાત! હું તમને કેવી રીતે મદદ કરી શકું?',
        'નમસ્કાર, આજે તમારો સમય આપવા બદલ આભાર.'
      ],
      confirmation: [
        'હું સમજું છું, શેર કરવા બદલ આભાર.',
        'તે સમજાય છે, મને તેની નોંધ લેવા દો.',
        'પુષ્ટિ કરવા બદલ આભાર.'
      ],
      farewell: [
        'આજે તમારા સમય માટે આભાર. તમારો દિવસ શુભ રહે!',
        'તમારી સાથે વાત કરીને સારું લાગ્યું. આવજો!',
        'વાતચીત માટે આભાર. ધ્યાન રાખજો!'
      ],
      objectionHandling: [
        'હું તમારી ચિંતા સમજું છું. મને તેનું સમાધાન કરવા દો...',
        'તે એક માન્ય મુદ્દો છે. અમે આ રીતે મદદ કરી શકીએ...',
        'હું તમારા દૃષ્ટિકોણની કદર કરું છું. શું હું સૂચવી શકું...'
      ],
      clarification: [
        'શું તમે કૃપા કરીને સ્પષ્ટ કરી શકો કે તમારો શું અર્થ છે?',
        'હું ખાતરી કરવા માંગું છું કે હું યોગ્ય રીતે સમજી રહ્યો છું. શું તમે કહી રહ્યા છો...',
        'શું તમે તેને થોડી વધુ વિગતમાં સમજાવી શકો છો?'
      ]
    },
    complianceDisclosures: {
      callRecording: 'આ કૉલ ગુણવત્તા અને તાલીમના હેતુઓ માટે રેકોર્ડ કરવામાં આવી રહ્યો છે.',
      aiDisclosure: 'હું આજે તમારી પૂછપરછમાં મદદ કરતો AI સહાયક છું.',
      marketingDisclosure: 'આ [કંપનીનું નામ] તરફથી માર્કેટિંગ કૉલ છે.',
      doNotCall: 'જો તમે અમારી ડુ-નોટ-કૉલ રજિસ્ટ્રીમાં ઉમેરવા માંગતા હો, તો કૃપા કરીને મને જણાવો.'
    }
  }
};

/**
 * Service for language detection and handling
 */
export class LanguageService {
  /**
   * Get configuration for a specific language
   */
  public getLanguageConfig(language: SupportedLanguage): LanguageConfig {
    return LANGUAGE_CONFIGS[language];
  }
  
  /**
   * Get all enabled language configurations
   */
  public getEnabledLanguages(): LanguageConfig[] {
    return Object.values(LANGUAGE_CONFIGS).filter(config => config.isEnabled);
  }
  
  /**
   * Detect language from text
   * This is a simplified implementation - in production use a real NLP service
   */
  public detectLanguage(text: string): { language: SupportedLanguage, confidence: number } {
    const normalizedText = text.toLowerCase();
    
    // Simple character-based detection for different scripts
    // This is just a basic example, real implementation would use proper NLP
    
    // Devanagari script (Hindi, Marathi)
    if (/[\u0900-\u097F]/.test(normalizedText)) {
      // Differentiate Hindi vs Marathi (simplified)
      return {
        language: normalizedText.includes('आहे') ? SupportedLanguage.MARATHI : SupportedLanguage.HINDI,
        confidence: 0.85
      };
    }
    
    // Bengali script
    if (/[\u0980-\u09FF]/.test(normalizedText)) {
      return { language: SupportedLanguage.BENGALI, confidence: 0.9 };
    }
    
    // Tamil script
    if (/[\u0B80-\u0BFF]/.test(normalizedText)) {
      return { language: SupportedLanguage.TAMIL, confidence: 0.9 };
    }
    
    // Telugu script
    if (/[\u0C00-\u0C7F]/.test(normalizedText)) {
      return { language: SupportedLanguage.TELUGU, confidence: 0.9 };
    }
    
    // Gurmukhi script (Punjabi)
    if (/[\u0A00-\u0A7F]/.test(normalizedText)) {
      return { language: SupportedLanguage.PUNJABI, confidence: 0.9 };
    }
    
    // Gujarati script
    if (/[\u0A80-\u0AFF]/.test(normalizedText)) {
      return { language: SupportedLanguage.GUJARATI, confidence: 0.9 };
    }
    
    // Default to English for Latin script
    return { language: SupportedLanguage.ENGLISH, confidence: 0.8 };
  }
  
  /**
   * Get Deepgram configuration for a specific language
   */
  public getDeepgramConfig(language: SupportedLanguage): { language: string, model: string, tier: string } {
    const config = LANGUAGE_CONFIGS[language];
    return {
      language: config.code,
      model: config.deepgramModel,
      tier: config.deepgramTier
    };
  }
  
  /**
   * Get TRAI compliance script for a specific language
   */
  public getComplianceScript(language: SupportedLanguage): string {
    const config = LANGUAGE_CONFIGS[language];
    return `${config.complianceDisclosures.aiDisclosure} ${config.complianceDisclosures.callRecording} ${config.complianceDisclosures.marketingDisclosure} ${config.complianceDisclosures.doNotCall}`;
  }
  
  /**
   * Get greeting phrases for a specific language
   */
  public getGreetingPhrases(language: SupportedLanguage): string[] {
    return LANGUAGE_CONFIGS[language].commonPhrases.greeting;
  }
  
  /**
   * Get farewell phrases for a specific language
   */
  public getFarewellPhrases(language: SupportedLanguage): string[] {
    return LANGUAGE_CONFIGS[language].commonPhrases.farewell;
  }
}

// Singleton instance
let languageService: LanguageService | null = null;

export const getLanguageService = (): LanguageService => {
  if (!languageService) {
    languageService = new LanguageService();
    logger.info('LanguageService initialized');
  }
  return languageService;
};

export const initializeLanguageService = (): LanguageService => {
  languageService = new LanguageService();
  logger.info('LanguageService initialized');
  return languageService;
};

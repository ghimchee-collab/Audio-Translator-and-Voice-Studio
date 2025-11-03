
import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { LANGUAGES } from './constants';
import { transcribeAudio, translateText, generateSpeech } from './services/geminiService';
import { fileToBase64, createWavBlob, decodeBase64 } from './utils/audio';
import { UploadIcon, TranslateIcon, PlayIcon, DownloadIcon, SpinnerIcon, CheckIcon, ErrorIcon } from './components/icons';

type Translation = {
  lang: string;
  langCode: string;
  text: string;
  audioUrl: string | null;
  isGeneratingAudio: boolean;
};

type AppState = 'initial' | 'transcribing' | 'transcribed' | 'translating' | 'error';

const App: React.FC = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [originalTranscription, setOriginalTranscription] = useState<string>('');
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(LANGUAGES[0].code);
  const [activeTab, setActiveTab] = useState<string>('en');
  const [appState, setAppState] = useState<AppState>('initial');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setOriginalTranscription('');
      setTranslations([]);
      setActiveTab('en');
      setAppState('initial');
      setError(null);
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setAppState('transcribing');
    setError(null);
    try {
      const { base64, mimeType } = await fileToBase64(audioFile);
      const transcription = await transcribeAudio(base64, mimeType);
      setOriginalTranscription(transcription);
      setAppState('transcribed');
      setActiveTab('en');
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Failed to transcribe audio. Please try again.');
      setAppState('error');
    }
  };
  
  const handleTranslate = async () => {
    if (!originalTranscription || translations.some(t => t.langCode === selectedLanguage)) return;
    setAppState('translating');
    setError(null);
    try {
      const translatedText = await translateText(originalTranscription, LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'this language');
      const newTranslation: Translation = {
        lang: LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'Unknown',
        langCode: selectedLanguage,
        text: translatedText,
        audioUrl: null,
        isGeneratingAudio: false,
      };
      setTranslations(prev => [...prev, newTranslation]);
      setActiveTab(selectedLanguage);
      setAppState('transcribed'); 
    } catch (err) {
      console.error('Translation error:', err);
      setError('Failed to translate text. Please try again.');
      setAppState('error');
    }
  };

  const handleGenerateVoiceover = async (langCode: string) => {
    const translationIndex = translations.findIndex(t => t.langCode === langCode);
    if (translationIndex === -1) return;
    
    setTranslations(prev => prev.map((t, i) => i === translationIndex ? { ...t, isGeneratingAudio: true } : t));
    setError(null);

    try {
      const textToSpeak = translations[translationIndex].text;
      const audioBase64 = await generateSpeech(textToSpeak);
      const pcmData = decodeBase64(audioBase64);
      const wavBlob = createWavBlob(pcmData, { sampleRate: 24000, channels: 1, bitsPerSample: 16 });
      const audioUrl = URL.createObjectURL(wavBlob);

      setTranslations(prev => prev.map((t, i) => i === translationIndex ? { ...t, audioUrl, isGeneratingAudio: false } : t));
    } catch (err) {
      console.error('Voiceover error:', err);
      setError(`Failed to generate voiceover for ${translations[translationIndex].lang}.`);
      setTranslations(prev => prev.map((t, i) => i === translationIndex ? { ...t, isGeneratingAudio: false } : t));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Audio Translator & Voiceover Studio
          </h1>
          <p className="text-gray-400 mt-2">Transcribe, Translate, and Generate Voiceovers with AI</p>
        </header>

        <main className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 space-y-8 border border-gray-700">
          <FileUploadSection audioFile={audioFile} onFileChange={handleFileChange} onTranscribe={handleTranscribe} appState={appState} />

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center">
              <ErrorIcon className="w-5 h-5 mr-3" />
              <span>{error}</span>
            </div>
          )}

          {(appState === 'transcribed' || appState === 'translating') && originalTranscription && (
            <>
              <TranslationControls 
                languages={LANGUAGES} 
                selectedLanguage={selectedLanguage} 
                onLanguageChange={setSelectedLanguage}
                onTranslate={handleTranslate}
                isLoading={appState === 'translating'}
                existingLanguages={translations.map(t => t.langCode)}
              />
              <ResultsTabs 
                originalTranscription={originalTranscription}
                translations={translations}
                activeTab={activeTab}
                onTabClick={setActiveTab}
                onGenerateVoiceover={handleGenerateVoiceover}
              />
            </>
          )}
        </main>
        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by Google Gemini</p>
        </footer>
      </div>
    </div>
  );
};

// --- Sub-components defined outside the main component to prevent re-renders ---

interface FileUploadSectionProps {
  audioFile: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTranscribe: () => void;
  appState: AppState;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({ audioFile, onFileChange, onTranscribe, appState }) => (
  <div className="flex flex-col md:flex-row items-center gap-4">
    <label htmlFor="audio-upload" className="w-full md:w-auto flex-grow cursor-pointer bg-gray-700 hover:bg-gray-600 border-2 border-dashed border-gray-500 rounded-lg p-4 text-center transition-colors">
      <div className="flex flex-col items-center justify-center">
        <UploadIcon className="w-8 h-8 text-gray-400 mb-2"/>
        <span className="font-semibold text-indigo-400">
          {audioFile ? 'File selected:' : 'Click to upload an audio file'}
        </span>
        <span className="text-gray-400 text-sm">
          {audioFile ? audioFile.name : '(MP3, WAV, M4A, etc.)'}
        </span>
      </div>
      <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={onFileChange} />
    </label>
    <button 
      onClick={onTranscribe}
      disabled={!audioFile || appState === 'transcribing'}
      className="w-full md:w-auto flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100"
    >
      {appState === 'transcribing' ? <SpinnerIcon /> : <CheckIcon className="w-5 h-5 mr-2" />}
      {appState === 'transcribing' ? 'Transcribing...' : 'Transcribe Audio'}
    </button>
  </div>
);


interface TranslationControlsProps {
  languages: { code: string; name: string }[];
  selectedLanguage: string;
  onLanguageChange: (value: string) => void;
  onTranslate: () => void;
  isLoading: boolean;
  existingLanguages: string[];
}

const TranslationControls: React.FC<TranslationControlsProps> = ({ languages, selectedLanguage, onLanguageChange, onTranslate, isLoading, existingLanguages }) => (
  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-gray-900/30 rounded-lg">
    <select 
      value={selectedLanguage}
      onChange={(e) => onLanguageChange(e.target.value)}
      className="w-full sm:w-auto flex-grow bg-gray-700 border border-gray-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {languages.map(lang => (
        <option key={lang.code} value={lang.code} disabled={existingLanguages.includes(lang.code)}>
          {lang.name}
        </option>
      ))}
    </select>
    <button 
      onClick={onTranslate}
      disabled={isLoading || existingLanguages.includes(selectedLanguage)}
      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-md flex items-center justify-center transition-all duration-300 ease-in-out"
    >
       {isLoading ? <SpinnerIcon /> : <TranslateIcon className="w-5 h-5 mr-2" />}
       {isLoading ? 'Translating...' : 'Translate'}
    </button>
  </div>
);

interface ResultsTabsProps {
  originalTranscription: string;
  translations: Translation[];
  activeTab: string;
  onTabClick: (langCode: string) => void;
  onGenerateVoiceover: (langCode: string) => void;
}

const ResultsTabs: React.FC<ResultsTabsProps> = ({ originalTranscription, translations, activeTab, onTabClick, onGenerateVoiceover }) => (
  <div>
    <div className="border-b border-gray-700">
      <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
        <TabButton isActive={activeTab === 'en'} onClick={() => onTabClick('en')}>English (Original)</TabButton>
        {translations.map(t => (
          <TabButton key={t.langCode} isActive={activeTab === t.langCode} onClick={() => onTabClick(t.langCode)}>
            {t.lang}
          </TabButton>
        ))}
      </nav>
    </div>
    <div className="py-5">
      {activeTab === 'en' && <TranscriptionPanel text={originalTranscription} />}
      {translations.map(t => (
        activeTab === t.langCode && (
          <TranscriptionPanel 
            key={t.langCode}
            text={t.text}
            audioUrl={t.audioUrl}
            isGeneratingAudio={t.isGeneratingAudio}
            onGenerateVoiceover={() => onGenerateVoiceover(t.langCode)}
            downloadFileName={`${t.lang.replace(/\s+/g, '_')}_voiceover.wav`}
          />
        )
      ))}
    </div>
  </div>
);

interface TabButtonProps {
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ isActive, onClick, children }) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap shrink-0 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
      isActive
        ? 'border-indigo-500 text-indigo-400'
        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
    }`}
  >
    {children}
  </button>
);


interface TranscriptionPanelProps {
  text: string;
  audioUrl?: string | null;
  isGeneratingAudio?: boolean;
  onGenerateVoiceover?: () => void;
  downloadFileName?: string;
}

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ text, audioUrl, isGeneratingAudio, onGenerateVoiceover, downloadFileName }) => (
  <div className="bg-gray-900/50 p-4 rounded-lg space-y-4">
    <textarea
      readOnly
      value={text}
      className="w-full h-48 bg-gray-800 text-gray-200 p-3 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
    />
    {onGenerateVoiceover && (
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {!audioUrl && (
          <button
            onClick={onGenerateVoiceover}
            disabled={isGeneratingAudio}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:bg-green-900/50 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center transition-colors"
          >
            {isGeneratingAudio ? <SpinnerIcon /> : <PlayIcon className="w-5 h-5 mr-2" />}
            {isGeneratingAudio ? 'Generating...' : 'Generate Voiceover'}
          </button>
        )}
        {audioUrl && (
          <>
            <audio controls src={audioUrl} className="w-full sm:flex-grow rounded-lg" />
            <a
              href={audioUrl}
              download={downloadFileName}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center transition-colors"
            >
              <DownloadIcon className="w-5 h-5 mr-2" />
              Download
            </a>
          </>
        )}
      </div>
    )}
  </div>
);


export default App;

'use client';

import React, { useState } from 'react';
import logger from '@/lib/logging';

interface SetupGuideProps {
  connectorName: string;
  serviceIdentifier: string; // To fetch specific guide steps
  // Optional: If guide steps are passed directly
  // steps?: Array<{ title: string; description: string; component?: React.ReactNode }>;
  onComplete?: () => void;
  onCancel?: () => void;
}

interface GuideStep {
  title: string;
  description: string;
  details?: string; // More detailed explanation or prerequisites
  // component?: React.ReactNode; // For custom input fields or interactive elements per step
}

// Mock function to fetch guide steps based on serviceIdentifier
async function fetchGuideSteps(serviceIdentifier: string): Promise<GuideStep[]> {
  logger.info({ serviceIdentifier }, 'Fetching setup guide steps.');
  // In a real app, this might fetch from a CMS, a JSON file, or an API endpoint
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay

  switch (serviceIdentifier) {
    case 'google-drive-basic':
      return [
        { title: 'Step 1: Authorize Access', description: 'Connect your Google Account to allow access to Google Drive.', details: 'You will be redirected to Google to grant permissions. Ensure pop-ups are not blocked.' },
        { title: 'Step 2: Select Folders (Optional)', description: 'Choose specific folders to sync, or sync all accessible files.' },
        { title: 'Step 3: Initial Sync', description: 'The first sync may take some time depending on the amount of data.' },
      ];
    case 'slack-notifications':
      return [
        { title: 'Step 1: Connect to Slack', description: 'Authorize the app to post messages to your Slack workspace.' },
        { title: 'Step 2: Choose Channel', description: 'Select the default Slack channel for notifications.' },
        { title: 'Step 3: Configure Notification Types', description: 'Select which events should trigger a Slack notification.' },
      ];
    default:
      return [
        { title: 'Step 1: General Configuration', description: `Provide the necessary API keys or credentials for ${serviceIdentifier}.`},
        { title: 'Step 2: Test Connection', description: 'Verify that the connection to the service is working correctly.'}
      ];
  }
}


export default function SetupGuide({ connectorName, serviceIdentifier, onComplete, onCancel }: SetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchGuideSteps(serviceIdentifier)
      .then(fetchedSteps => {
        setSteps(fetchedSteps);
        if (fetchedSteps.length === 0) {
            setError('No setup steps found for this connector.');
        }
      })
      .catch(err => {
        logger.error({ serviceIdentifier, error: err }, 'Failed to fetch setup guide steps.');
        setError('Could not load setup guide. Please try again.');
      })
      .finally(() => setIsLoading(false));
  }, [serviceIdentifier]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      logger.info({ connectorName, serviceIdentifier }, 'Setup guide completed.');
      onComplete?.();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading setup guide for {connectorName}...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }
  
  if (steps.length === 0) {
    return <div className="p-4">No setup information available for {connectorName}. Basic configuration might be done through the main settings.</div>;
  }

  const step = steps[currentStep];

  return (
    <div className="p-6 border rounded-lg shadow-lg bg-white max-w-lg mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Setup: {connectorName}</h2>
      <p className="text-sm text-gray-500 mb-6">Step {currentStep + 1} of {steps.length}: {step.title}</p>
      
      <div className="mb-6 min-h-[80px]">
        <p className="text-gray-700">{step.description}</p>
        {step.details && <p className="text-xs text-gray-500 mt-2">{step.details}</p>}
        {/* Placeholder for step-specific input component if needed */}
        {/* {step.component} */}
      </div>

      <div className="flex justify-between items-center mt-8">
        <div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-sm text-gray-600 hover:underline px-4 py-2 rounded-md mr-2"
            >
              Cancel
            </button>
          )}
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
            >
              Back
            </button>
          )}
        </div>
        <button
          onClick={handleNext}
          className="text-sm bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded-md"
        >
          {currentStep < steps.length - 1 ? 'Next' : 'Finish Setup'}
        </button>
      </div>
    </div>
  );
}
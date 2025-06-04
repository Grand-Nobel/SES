import { useState, useEffect } from 'react';
import throttle from 'lodash.throttle';
import { CommandParser } from '@/lib/nlp';

const CommandPalette = () => {
  // const [commands, setCommands] = useState<string[]>([]); // commands is unused
  const [, setCommands] = useState<string[]>([]); // Correctly destructure useState
  const parser = new CommandParser();

  useEffect(() => {
    parser.init();
  }, [parser]); // Added parser to dependency array

  const throttledParse = throttle(async (query: string) => {
    const results = await parser.parseCommand(query);
    setCommands(results);
  }, 500);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    throttledParse(e.target.value);
  };

  return <input onChange={handleInput} placeholder="Search commands..." />;
};

export default CommandPalette;

import React from 'react';
import { AppProvider } from './AppContext';
import { SchemaProvider } from './SchemaContext';
import { DSBulkProvider } from './DSBulkContext';
import { NB5Provider } from './NB5Context';
import { ReadYamlProvider } from './ReadYamlContext';
import { YamlProvider } from './YamlContext';

// Combined context provider that provides all application contexts
const ContextProvider = ({ children }) => {
  return (
    <AppProvider>
      <YamlProvider>
        <SchemaProvider>
          <DSBulkProvider>
            <NB5Provider>
              <ReadYamlProvider>
                {children}
              </ReadYamlProvider>
            </NB5Provider>
          </DSBulkProvider>
        </SchemaProvider>
      </YamlProvider>
    </AppProvider>
  );
};

export default ContextProvider;
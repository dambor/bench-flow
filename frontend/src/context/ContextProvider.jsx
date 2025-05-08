import React from 'react';
import { AppProvider } from './AppContext';
import { SchemaProvider } from './SchemaContext';
import { DSBulkProvider } from './DSBulkContext';
import { NB5Provider } from './NB5Context';
import { ReadYamlProvider } from './ReadYamlContext';

// Combined context provider that provides all application contexts
const ContextProvider = ({ children }) => {
  return (
    <AppProvider>
      <SchemaProvider>
        <DSBulkProvider>
          <NB5Provider>
            <ReadYamlProvider>
              {children}
            </ReadYamlProvider>
          </NB5Provider>
        </DSBulkProvider>
      </SchemaProvider>
    </AppProvider>
  );
};

export default ContextProvider;
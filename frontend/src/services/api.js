// frontend/src/services/api.js
// API client for communicating with the backend services

// Base URL for API calls
const API_BASE_URL = 'http://localhost:8001/api';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchWithErrorHandling(url, options = {}) {
  console.log(`Making request to: ${url}`);
  
  try {
    const response = await fetch(url, options);
    
    // Log response status
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      // Try to parse the error message from the response
      let errorMessage;
      let errorDetails = null;
      
      try {
        const errorData = await response.json();
        console.error('Error response data:', errorData);
        
        // Handle FastAPI error format which often has a 'detail' field
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.join('; ');
          } else if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        } else {
          errorMessage = `Server error: ${response.status}`;
        }
        
        errorDetails = errorData;
      } catch (e) {
        console.error('Could not parse error response as JSON, trying text');
        try {
          const textError = await response.text();
          errorMessage = `Server error (${response.status}): ${textError}`;
          console.error('Error text response:', textError);
        } catch (textError) {
          errorMessage = `Server error: ${response.status}`;
        }
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.details = errorDetails;
      throw error;
    }
    
    // Check if response is empty
    const text = await response.text();
    if (!text) {
      console.log('Empty response from server');
      return {};
    }
    
    try {
      const jsonData = JSON.parse(text);
      console.log('Successful response data:', jsonData);
      return jsonData;
    } catch (e) {
      console.error('Error parsing JSON response:', e);
      console.log('Raw response text:', text);
      // For raw text responses, just return the text
      return { text: text };
    }
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

/**
 * Create FormData from an object
 */
function createFormData(data) {
  const formData = new FormData();
  
  Object.entries(data).forEach(([key, value]) => {
    // Handle files specifically
    if (value instanceof File) {
      formData.append(key, value);
    } 
    // Special handling for yaml_content to ensure it's treated properly
    else if (key === 'yaml_content' && typeof value === 'string') {
      // Create a blob to ensure proper submission as a file
      const yamlBlob = new Blob([value], { type: 'text/plain' });
      formData.append(key, yamlBlob, 'content.yaml');
    }
    // Handle arrays or objects by converting to JSON string
    else if (typeof value === 'object' && value !== null) {
      formData.append(key, JSON.stringify(value));
    } 
    // Handle primitive values
    else if (value !== undefined && value !== null) {
      formData.append(key, value.toString());
    }
  });
  
  return formData;
}


// Schema Parser API
export const schemaApi = {
  // Parse a CQL schema file
  parseSchema: async (schemaFile) => {
    const formData = new FormData();
    formData.append('schema_file', schemaFile);
    
    return fetchWithErrorHandling(`${API_BASE_URL}/parse-schema`, {
      method: 'POST',
      body: formData
    });
  },
  
  // Generate YAML files for selected tables
  generateYaml: async (schemaJson, tableSelection) => {
    const formData = new FormData();
    formData.append('schema_json', JSON.stringify(schemaJson));
    formData.append('table_selection', JSON.stringify(tableSelection));
    
    return fetchWithErrorHandling(`${API_BASE_URL}/generate-yaml`, {
      method: 'POST',
      body: formData
    });
  },
  
  // Generate a single YAML file for a table
  generateYamlSingle: async (tableName, schemaJson) => {
    const params = new URLSearchParams({
      table_name: tableName
    });
    
    if (schemaJson) {
      params.append('schema_json', JSON.stringify(schemaJson));
    }
    
    return fetchWithErrorHandling(`${API_BASE_URL}/generate-yaml-single?${params.toString()}`);
  }
};

// DSBulk API
export const dsbulkApi = {
  // Validate DSBulk installation
  validate: async () => {
    return fetchWithErrorHandling(`${API_BASE_URL}/dsbulk/validate`);
  },
  
  // Generate DSBulk commands
  generateCommands: async (params) => {
    const formData = createFormData(params);
    
    return fetchWithErrorHandling(`${API_BASE_URL}/dsbulk/generate-commands`, {
      method: 'POST',
      body: formData
    });
  },
  
  // Execute a DSBulk command
  executeCommand: async (command, saveOutput = false) => {
    const formData = new FormData();
    formData.append('command', command);
    formData.append('save_output', saveOutput);
    
    return fetchWithErrorHandling(`${API_BASE_URL}/dsbulk/execute`, {
      method: 'POST',
      body: formData
    });
  },
  
  // Download a DSBulk script
  downloadScript: async (params) => {
    const formData = createFormData(params);
    
    // This endpoint returns a file for download
    const response = await fetch(`${API_BASE_URL}/dsbulk/download-script`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || `Server error: ${response.status}`;
      } catch (e) {
        errorMessage = `Server error: ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    
    return response;
  }
};

// NoSQLBench NB5 API
export const nb5Api = {
  // Validate NB5 installation
  validate: async () => {
    return fetchWithErrorHandling(`${API_BASE_URL}/nb5/validate`);
  },
  
  // Generate NB5 command
  generateCommand: async (params) => {
    const formData = createFormData(params);
    
    return fetchWithErrorHandling(`${API_BASE_URL}/nb5/generate-command`, {
      method: 'POST',
      body: formData
    });
  },
  
  // Execute NB5 command - UPDATED to handle file path properly
  executeNb5: async (params) => {
    // Log that we're executing with file path if available
    if (params.yaml_file) {
      console.log('Executing NB5 with file path:', params.yaml_file);
    }
    
    // If both yaml_file and yaml_content are provided, prefer yaml_file
    if (params.yaml_file && params.yaml_content) {
      console.log('Both yaml_file and yaml_content provided - using yaml_file');
      const paramsWithoutContent = { ...params };
      delete paramsWithoutContent.yaml_content;
      
      try {
        return await fetchWithErrorHandling(`${API_BASE_URL}/nb5/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(paramsWithoutContent)
        });
      } catch (error) {
        console.error('Error executing with yaml_file:', error);
        throw error;
      }
    }
    
    // Otherwise, proceed with normal form data method
    const apiFormData = createFormData(params);
    
    // Log the keys being sent (but not the actual content for security)
    console.log('Sending form data keys:', Object.keys(params));
    
    return fetchWithErrorHandling(`${API_BASE_URL}/nb5/execute`, {
      method: 'POST',
      body: apiFormData
    });
  },
  
  // Get execution status
  getExecutionStatus: async (executionId) => {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        return await fetchWithErrorHandling(`${API_BASE_URL}/nb5/status/${executionId}`);
      } catch (error) {
        retries++;
        console.log(`Retry ${retries}/${maxRetries} for execution status ${executionId}`);
        
        // Only throw if we've exhausted all retries
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  },
  
  // Terminate execution
  terminateExecution: async (executionId) => {
    return fetchWithErrorHandling(`${API_BASE_URL}/nb5/terminate/${executionId}`, {
      method: 'POST'
    });
  },
  
  // List all executions
  listExecutions: async () => {
    return fetchWithErrorHandling(`${API_BASE_URL}/nb5/list`);
  },
  
  // Download NB5 script
  downloadScript: async (params) => {
    const formData = createFormData(params);
    
    // This endpoint returns a file for download
    const response = await fetch(`${API_BASE_URL}/nb5/download-script`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || `Server error: ${response.status}`;
      } catch (e) {
        errorMessage = `Server error: ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    
    return response;
  }
};

// Read YAML Generator API
export const readYamlApi = {
  // Process a ZIP file containing ingestion YAML files
  processIngestionFiles: async (zipFile) => {
    const formData = new FormData();
    formData.append('ingestion_zip', zipFile);
    
    return fetchWithErrorHandling(`${API_BASE_URL}/process-ingestion-files`, {
      method: 'POST',
      body: formData
    });
  },
  
  // Process multiple individual YAML files
  processMultipleFiles: async (files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    return fetchWithErrorHandling(`${API_BASE_URL}/process-multiple-files`, {
      method: 'POST',
      body: formData
    });
  },
  
  // Process a single ingestion YAML file
  processIngestionFile: async (file) => {
    const formData = new FormData();
    formData.append('ingestion_file', file);
    
    // This endpoint returns a file for download
    const response = await fetch(`${API_BASE_URL}/process-ingestion-file`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || `Server error: ${response.status}`;
      } catch (e) {
        errorMessage = `Server error: ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    
    return response;
  },
  
  // Generate a read YAML file from a write YAML file
  generateReadYaml: async (writeYamlFile, csvPath, primaryKeyColumns) => {
    const formData = new FormData();
    formData.append('write_yaml_file', writeYamlFile);
    formData.append('csv_path', csvPath);
    formData.append('primary_key_columns', primaryKeyColumns);
    
    // This endpoint returns a file for download
    const response = await fetch(`${API_BASE_URL}/generate-read-yaml`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || `Server error: ${response.status}`;
      } catch (e) {
        errorMessage = `Server error: ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    
    return response;
  },
  
  // Generate a read YAML file and return JSON response
  generateReadYamlJson: async (writeYamlFile, csvPath, primaryKeyColumns) => {
    const formData = new FormData();
    formData.append('write_yaml_file', writeYamlFile);
    formData.append('csv_path', csvPath);
    formData.append('primary_key_columns', primaryKeyColumns);
    
    return fetchWithErrorHandling(`${API_BASE_URL}/generate-read-yaml-json`, {
      method: 'POST',
      body: formData
    });
  }
};

// Health check API
export const healthApi = {
  checkHealth: async () => {
    return fetchWithErrorHandling(`${API_BASE_URL}/health`);
  }
};

// Export all APIs
export default {
  schema: schemaApi,
  dsbulk: dsbulkApi,
  nb5: nb5Api,
  readYaml: readYamlApi,
  health: healthApi
};
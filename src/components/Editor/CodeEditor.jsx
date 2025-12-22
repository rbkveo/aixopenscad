import React from 'react';
import { Editor } from '@monaco-editor/react';

const CodeEditor = ({ code, onChange }) => {
  return (
    <div className="editor-container" style={{ height: '100%', width: '100%' }}>
      <Editor
        height="100%"
        defaultLanguage="cpp" // OpenSCAD is close to C++/Java/C# syntax
        theme="vs-dark"
        value={code}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'var(--font-mono)',
          glyphMargin: true,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          readOnly: false,
          automaticLayout: true,
          padding: { top: 16 }
        }}
      />
    </div>
  );
};

export default CodeEditor;

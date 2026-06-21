import React, { useState } from 'react';
import { Palette, Type, Layout, Zap } from 'lucide-react';

interface DesignOptions {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  accentColor: string;
  maxWidth: number;
}

interface DesignEditorProps {
  options: DesignOptions;
  onChange: (options: DesignOptions) => void;
  onReset: () => void;
}

export const DesignEditor: React.FC<DesignEditorProps> = ({
  options,
  onChange,
  onReset,
}) => {
  const fonts = ['Inter', 'Georgia', 'Merriweather', 'Source Code Pro'];
  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];

  const handleChange = (field: keyof DesignOptions, value: any) => {
    onChange({ ...options, [field]: value });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Appearance
        </h3>
        <button
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Reset
        </button>
      </div>

      {/* Font */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Type className="w-4 h-4" />
          Font
        </label>
        <select
          value={options.fontFamily}
          onChange={(e) => handleChange('fontFamily', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {fonts.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Size: <span className="text-gray-500 font-normal">{options.fontSize}px</span>
        </label>
        <input
          type="range"
          min="12"
          max="20"
          value={options.fontSize}
          onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Line Height */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Layout className="w-4 h-4" />
          Spacing: <span className="text-gray-500 font-normal">{(options.lineHeight / 10).toFixed(1)}x</span>
        </label>
        <input
          type="range"
          min="10"
          max="20"
          value={options.lineHeight}
          onChange={(e) => handleChange('lineHeight', parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Accent Color */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Zap className="w-4 h-4" />
          Accent
        </label>
        <div className="flex gap-2">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => handleChange('accentColor', color)}
              className={`w-8 h-8 rounded-full transition-all ${
                options.accentColor === color ? 'ring-2 ring-offset-2 ring-gray-300' : ''
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Width */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Max width: <span className="text-gray-500 font-normal">{options.maxWidth}px</span>
        </label>
        <input
          type="range"
          min="600"
          max="1000"
          step="50"
          value={options.maxWidth}
          onChange={(e) => handleChange('maxWidth', parseInt(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
};

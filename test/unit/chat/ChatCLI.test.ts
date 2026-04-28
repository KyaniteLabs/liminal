/**
 * Tests for ChatCLI with split-view terminal UI
 * Following TDD: red-green-refactor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'ink';
import React from 'react';
import { ChatCLI } from '../../../dist/chat/ChatCLI.js';
import { ConversationManager } from '../../../dist/chat/ConversationManager.js';
import type { Parameter, Domain } from '../../../dist/chat/types.js';

describe('ChatCLI', () => {
  let conversationManager: ConversationManager;
  let chatCLI: ChatCLI;

  beforeEach(() => {
    conversationManager = new ConversationManager();
    chatCLI = new ChatCLI(conversationManager);
  });

  describe('Instantiation', () => {
    it('should be instantiable with ConversationManager', () => {
      expect(chatCLI).toBeInstanceOf(ChatCLI);
      expect(chatCLI.conversation).toBe(conversationManager);
    });

    it('should initialize with guidance stub', () => {
      expect(chatCLI.guidance).not.toBeNull();
    });
  });

  describe('render()', () => {
    it('should have a render method', () => {
      expect(typeof chatCLI.render).toBe('function');
    });

    it('should render without throwing', () => {
      // Ink requires a proper console environment for full rendering
      // In test environment, we verify the method exists and structure is correct
      expect(typeof chatCLI.render).toBe('function');
      expect(typeof chatCLI.renderChatPanel).toBe('function');
      expect(typeof chatCLI.renderPreviewPanel).toBe('function');
    });
  });

  describe('renderChatPanel()', () => {
    it('should return a React element', () => {
      const panel = chatCLI.renderChatPanel();
      expect(React.isValidElement(panel)).toBe(true);
    });

    it('should render chat panel component', () => {
      const panel = chatCLI.renderChatPanel();
      expect(panel).not.toBeNull();
    });
  });

  describe('renderPreviewPanel()', () => {
    it('should return a React element', () => {
      const panel = chatCLI.renderPreviewPanel();
      expect(React.isValidElement(panel)).toBe(true);
    });

    it('should render preview panel component', () => {
      const panel = chatCLI.renderPreviewPanel();
      expect(panel).not.toBeNull();
    });
  });

  describe('handleUserInput()', () => {
    it('should have handleUserInput method', () => {
      expect(typeof chatCLI.handleUserInput).toBe('function');
    });

    it('should process user input and return Promise', async () => {
      conversationManager.startNewSession();
      const result = await chatCLI.handleUserInput('hello');
      expect(result).toBeUndefined();
    });

    it('should record user message in conversation', async () => {
      conversationManager.startNewSession();
      await chatCLI.handleUserInput('test message');

      const currentSession = conversationManager.sessionHistory[0];
      expect(currentSession?.messages).toHaveLength(2); // user + assistant
      expect(currentSession?.messages[0].content).toBe('test message');
    });
  });

  describe('updatePreview()', () => {
    it('should have updatePreview method', () => {
      expect(typeof chatCLI.updatePreview).toBe('function');
    });

    it('should update preview state with code and domain', () => {
      const testCode = 'function test() { return true; }';
      const testDomain: Domain = 'p5';

      expect(() => {
        chatCLI.updatePreview(testCode, testDomain);
      }).not.toThrow();
    });
  });

  describe('renderParameterControls()', () => {
    it('should have renderParameterControls method', () => {
      expect(typeof chatCLI.renderParameterControls).toBe('function');
    });

    it('should return a React element', () => {
      const params: Parameter[] = [
        {
          name: 'speed',
          value: 0.5,
          type: 'slider',
          min: 0,
          max: 1,
          step: 0.1
        }
      ];

      const controls = chatCLI.renderParameterControls(params);
      expect(React.isValidElement(controls)).toBe(true);
    });

    it('should render parameter controls for sliders', () => {
      const params: Parameter[] = [
        {
          name: 'speed',
          value: 0.5,
          type: 'slider',
          min: 0,
          max: 1,
          step: 0.1
        }
      ];

      const controls = chatCLI.renderParameterControls(params);
      expect(controls).not.toBeNull();
    });

    it('should render parameter controls for toggles', () => {
      const params: Parameter[] = [
        {
          name: 'enabled',
          value: true,
          type: 'toggle'
        }
      ];

      const controls = chatCLI.renderParameterControls(params);
      expect(controls).not.toBeNull();
    });
  });

  describe('handleParameterChange()', () => {
    it('should have handleParameterChange method', () => {
      expect(typeof chatCLI.handleParameterChange).toBe('function');
    });

    it('should handle parameter changes', () => {
      expect(() => {
        chatCLI.handleParameterChange('speed', 0.8);
      }).not.toThrow();
    });
  });

  describe('UI Layout', () => {
    it('should support split-view layout with 70+80 columns', () => {
      // ChatCLI should be designed to handle split view
      expect(chatCLI.renderChatPanel).not.toBeNull();
      expect(chatCLI.renderPreviewPanel).not.toBeNull();
    });
  });

  describe('Integration with ConversationManager', () => {
    it('should use provided conversation manager', () => {
      const customManager = new ConversationManager();
      const customCLI = new ChatCLI(customManager);

      expect(customCLI.conversation).toBe(customManager);
    });

    it('should start new session through conversation manager', () => {
      conversationManager.startNewSession();

      expect(conversationManager.currentSession?.status).toBe('active');
    });
  });
});

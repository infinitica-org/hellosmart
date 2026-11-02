import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { CandidateProfileView } from '../app/(candidate)/candidate/profile/page';
import type { UserMe } from '../lib/api-client';

describe('Candidate Profile View & Component (BUG-12)', () => {
  it('renders loading state when loading is true and user is null', () => {
    const element = CandidateProfileView({ loading: true, user: null });
    expect(element).toBeDefined();
    expect(element.props['data-testid']).toBe('candidate-profile-loading');
  });

  it('renders real candidate user details from authenticated session', () => {
    const mockUser: UserMe = {
      id: 'usr_candidate_99',
      name: 'Alex Developer',
      email: 'alex.developer@techcorp.com',
      role: 'candidate',
      portal: 'candidate',
      mustResetPassword: false,
      org: {
        id: 'org_techcorp_1',
        name: 'TechCorp Engineering',
      },
    };

    const element = CandidateProfileView({
      user: mockUser,
      loading: false,
      timezone: 'America/New_York',
    });

    expect(element).toBeDefined();
    expect(element.props['data-testid']).toBe('candidate-profile-page');

    // Helper to recursively find element by testid
    const findByTestId = (root: any, testId: string): any => {
      if (!root || typeof root !== 'object') return null;
      if (root.props?.['data-testid'] === testId) return root;
      if (root.props?.children) {
        const children = React.Children.toArray(root.props.children);
        for (const child of children) {
          const match = findByTestId(child, testId);
          if (match) return match;
        }
      }
      return null;
    };

    const nameNode = findByTestId(element, 'profile-name');
    expect(nameNode).toBeDefined();
    expect(nameNode.props.children).toBe('Alex Developer');

    const emailNode = findByTestId(element, 'profile-email');
    expect(emailNode).toBeDefined();
    expect(emailNode.props.children).toBe('alex.developer@techcorp.com');

    const avatarNode = findByTestId(element, 'profile-avatar');
    expect(avatarNode).toBeDefined();
    expect(avatarNode.props.children).toBe('A');

    const timezoneNode = findByTestId(element, 'profile-timezone');
    expect(timezoneNode).toBeDefined();
    expect(timezoneNode.props.children).toBe('America/New_York');

    const orgNode = findByTestId(element, 'profile-org');
    expect(orgNode).toBeDefined();
    expect(orgNode.props.children).toBe('TechCorp Engineering');

    const idNode = findByTestId(element, 'profile-id');
    expect(idNode).toBeDefined();
    expect(idNode.props.children).toBe('usr_candidate_99');

    const statusNode = findByTestId(element, 'profile-status');
    expect(statusNode).toBeDefined();
    expect(statusNode.props.children).toBe('Ready for Assessment');
  });

  it('renders password reset warning when user.mustResetPassword is true (BR-24)', () => {
    const mockUser: UserMe = {
      id: 'usr_candidate_firstlogin',
      name: 'New Candidate',
      email: 'new.candidate@example.com',
      role: 'candidate',
      portal: 'candidate',
      mustResetPassword: true,
      org: {
        id: 'org_acme',
        name: 'Acme Simulation Academy',
      },
    };

    const element = CandidateProfileView({
      user: mockUser,
      loading: false,
    });

    const findByTestId = (root: any, testId: string): any => {
      if (!root || typeof root !== 'object') return null;
      if (root.props?.['data-testid'] === testId) return root;
      if (root.props?.children) {
        const children = React.Children.toArray(root.props.children);
        for (const child of children) {
          const match = findByTestId(child, testId);
          if (match) return match;
        }
      }
      return null;
    };

    const resetWarning = findByTestId(element, 'profile-reset-warning');
    expect(resetWarning).toBeDefined();

    const statusNode = findByTestId(element, 'profile-status');
    expect(statusNode.props.children).toBe('Password Reset Required (BR-24)');
  });

  it('wires up sign out callback button', () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined);
    const mockUser: UserMe = {
      id: 'usr_candidate_1',
      name: 'Sam Tester',
      email: 'sam@example.com',
      role: 'candidate',
      portal: 'candidate',
      mustResetPassword: false,
      org: null,
    };

    const element = CandidateProfileView({
      user: mockUser,
      loading: false,
      onSignOut: mockSignOut,
    });

    const findByTestId = (root: any, testId: string): any => {
      if (!root || typeof root !== 'object') return null;
      if (root.props?.['data-testid'] === testId) return root;
      if (root.props?.children) {
        const children = React.Children.toArray(root.props.children);
        for (const child of children) {
          const match = findByTestId(child, testId);
          if (match) return match;
        }
      }
      return null;
    };

    const signOutBtn = findByTestId(element, 'profile-signout-btn');
    expect(signOutBtn).toBeDefined();
    signOutBtn.props.onClick();
    expect(mockSignOut).toHaveBeenCalled();
  });
});


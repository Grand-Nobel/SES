import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';
import { PrivacyLogger } from '@/lib/logging';

jest.mock('@/lib/logging', () => ({
  PrivacyLogger: jest.fn(() => ({
    log: jest.fn().mockResolvedValue({}),
  })),
}));

describe('Button', () => {
  it('renders primary button', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toHaveClass('button--primary');
  });

  it('handles click events', async () => {
    const onClick = jest.fn();
    render(<Button data-testid="test-button" onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByTestId('test-button'));
    expect(onClick).toHaveBeenCalled();
    expect(PrivacyLogger().log).toHaveBeenCalledWith('buttonClick', { id: 'test-button' });
  });

  it('disables button when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });
});
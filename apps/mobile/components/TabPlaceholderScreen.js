import { EmptyState, ScreenContainer } from './ui';

export default function TabPlaceholderScreen({ title, subtitle }) {
  return (
    <ScreenContainer>
      <EmptyState title={title} message={subtitle} />
    </ScreenContainer>
  );
}

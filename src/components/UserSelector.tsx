import type { User } from '../types';

interface Props {
  user: User;
  onSwitch: (user: User) => void;
}

export default function UserSelector({ user, onSwitch }: Props) {
  return (
    <div className="flex bg-gray-100 rounded-full p-1 gap-1">
      {(['bram', 'helena'] as const).map((name) => (
        <button
          key={name}
          onClick={() => onSwitch(name)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all min-h-[36px] ${
            user === name
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-500'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

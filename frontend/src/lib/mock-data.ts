export type Player = {
  id: string;
  name: string; // IGN
  address: string;
  role: string;
  bio: string;
  winPoints: number;
  price: number;
  highestBid?: number;
  owner: string;
  endTime: string;
  stats: {
    kda: string;
    winRate: string;
    matches: number;
    tournamentsWon: number;
    mvpAwards: number;
    avgGoldMin: string;
  };
  achievements: string[];
  isListed: boolean;
  currentBidder?: string | null;
};

export const INITIAL_PLAYERS: Player[] = [
  {
    id: "1",
    name: "ZERO_COOL",
    address: "GBX1...8A9F",
    owner: "GBX1...8A9F",
    role: "Jungler",
    bio: "Aggressive pathing. First blood specialist in the current meta. Dominant in early game skirmishes.",
    winPoints: 450,
    price: 4500,
    highestBid: 4200,
    endTime: "12:45",
    stats: {
      kda: "5.2",
      winRate: "78%",
      matches: 312,
      tournamentsWon: 4,
      mvpAwards: 18,
      avgGoldMin: "14.2k",
    },
    achievements: ["MPL PH S13 - Champion", "MSC 2024 - Golden Staff"],
    isListed: true
  },
  {
    id: "2",
    name: "NEON_GHOST",
    address: "GBA2...7B1C",
    owner: "GBA2...7B1C",
    role: "Midlane",
    bio: "Unpredictable assassin player. Thrives in chaos and high-pressure situations. Extensive hero pool.",
    winPoints: 380,
    price: 3200,
    highestBid: 3100,
    endTime: "08:20",
    stats: {
      kda: "4.8",
      winRate: "65%",
      matches: 210,
      tournamentsWon: 2,
      mvpAwards: 8,
      avgGoldMin: "12.1k",
    },
    achievements: ["M5 - MVP", "Snapdragon Pro Series - Winner"],
    isListed: true
  }
];
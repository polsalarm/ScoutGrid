export interface LoanRecord {
  borrower: string;
  principal: number;   // in XLM
  startLedger: number;
  dueLedger: number;
}

export type Player = {
  id: string;
  name: string;
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

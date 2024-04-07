import { APIBadge, APICapitalLeague, APIClanMember, APIWarLeague } from 'clashofclans.js';

export class ClanMemberChangesOutput {
  clan: {
    name: string;
    tag: string;
    members: number;
    badgeUrls: APIBadge;
  };
  donationsLog: {
    name: string;
    tag: string;
    townHallLevel: number;
    donations: number;
  }[];
  donationsReceivedLog: {
    name: string;
    tag: string;
    townHallLevel: number;
    donationsReceived: number;
  }[];
  roleChangeLog: {
    name: string;
    tag: string;
    townHallLevel: number;
    oldRole: APIClanMember['role'];
    role: APIClanMember['role'];
  }[];
  townHallChangeLog: {
    name: string;
    tag: string;
    townHallLevel: number;
  }[];
  nameChangeLog: {
    name: string;
    tag: string;
    townHallLevel: number;
    oldName: string;
  }[];
  leagueChangeLog: {
    name: string;
    tag: string;
    townHallLevel: number;
    oldLeague: APIClanMember['league'];
    league: APIClanMember['league'];
  }[];
  legendsLog: {
    name: string;
    tag: string;
    trophies: number;
    trophiesGained: number;
    oldTrophies: number;
    timestamp: number;
  }[];
  reJoinedLog: {
    name: string;
    tag: string;
    townHallLevel: number;
    donations: number;
    donationsReceived: number;
  }[];
  memberJoinedLog: {
    name: string;
    tag: string;
    townHallLevel: number;
  }[];
  memberLeftLog: {
    name: string;
    tag: string;
    townHallLevel: number;
  }[];
}

export class ClanChangesOutput {
  name: string;
  tag: string;
  clanLevel: number;
  oldWarLeague?: APIWarLeague;
  warLeague?: APIWarLeague;
  oldCapitalLeague?: APICapitalLeague;
  capitalLeague?: APICapitalLeague;
}

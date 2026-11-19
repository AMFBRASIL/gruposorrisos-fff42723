import type { Client, Project, User } from "@/lib/mock-data";

let people: User[] = [];
let projectRows: Project[] = [];
let clientRows: Client[] = [];

export function bindPeople(list: User[]) {
  people = list;
}

export function bindProjects(list: Project[]) {
  projectRows = list;
}

export function bindClients(list: Client[]) {
  clientRows = list;
}

export function findPerson(id?: string | null) {
  return people.find((person) => person.id === id);
}

export function findProjectRow(id?: string | null) {
  return projectRows.find((project) => project.id === id);
}

export function findClientRow(id?: string | null) {
  return clientRows.find((client) => client.id === id);
}

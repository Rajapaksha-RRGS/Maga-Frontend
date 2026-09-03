export interface User {
  id: number;
  name: string;
  role: string;
  status: 'active' | 'inactive';
}

export interface UserFormData {
  name: string;
  role: string;
}

// Dummy Database එක (API එකක් හදනකම් Test කරන්න)
let usersDB: User[] = [
  { id: 1, name: 'John Doe', role: 'Admin', status: 'active' },
  { id: 2, name: 'Jane Smith', role: 'Supervisor', status: 'active' },
  { id: 3, name: 'Kamal Perera', role: 'Worker', status: 'active' },
];

export async function getUsers():Promise<User[]>{

    // simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return usersDB;

}

export async function createUser(data:UserFormData):Promise<User>{

    const newUser : User = {
        id:Date.now(),
        name: data.name,
        role: data.role,
        status:'active' as const,
    };

    usersDB.push(newUser);

    await new Promise(resolve => setTimeout(resolve,500));
    return newUser;
    
}

export async function updateUser(id:number,data:UserFormData): Promise<User>{

const index = usersDB.findIndex((u)=>u.id === id);
if(index === -1) throw new Error('User not found');

const updateUser : User= {
    ...usersDB[index],
    name: data.name,
    role: data.role,

};

usersDB[index] = updateUser;

await new Promise(resolve=>setTimeout(resolve,500));
return updateUser;

}


export async function deleteUser(id:number): Promise<void>{

    const initialLength = usersDB.length;
    usersDB = usersDB.filter((u)=>u.id !== id);

    if(usersDB.length === initialLength) throw new Error ('User not found');

    await new Promise(resolve=>setTimeout(resolve,500));

}
import DataTable from "./DataTable";

interface User {
    id: number;
    name: string;
    role: string;
}
interface Column<T>{
    header: string;
    accessor: keyof T;
    render?: (item: T) => React.ReactNode;
}   

const userColumns: Column<User>[]=[
    {header: 'ID', accessor: 'id'},
    {header: 'Full Name', accessor: 'name'},
    {
        header: 'Role',
        accessor: 'role',
        render: (user:User) => <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded font-semibold">{user.role}</span>        
    },
];

// dummy data 
const userdata: User[]=[
    {id: 1, name: 'John Doe', role: 'Admin'},
    {id: 2, name: 'Jane Doe', role: 'User'},
    {id: 3, name: 'John Doe', role: 'Admin'},
    {id: 4, name: 'Jane Doe', role: 'User'},
    {id: 5, name: 'John Doe', role: 'Admin'},
    {id: 6, name: 'Jane Doe', role: 'User'},
    {id: 7, name: 'John Doe', role: 'Admin'},
    {id: 8, name: 'Jane Doe', role: 'User'},
];

export default function UseTable(){
    return(
        <div className="p-6">
            <DataTable columns={userColumns} data={userdata} keyField="id" />
        </div>
    )
}
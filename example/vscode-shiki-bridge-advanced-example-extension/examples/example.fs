[1..100]
|> Seq.map (function
    | x when x%5=0 && x%3=0 -> "FizzBuzz"
    | x when x%3=0 -> "Fizz"
    | x when x%5=0 -> "Buzz"
    | x -> string x)
|> Seq.iter (printfn "%s")

type Customer(firstName, middleInitial, lastName) =
    member this.FirstName = firstName
    member this.MiddleInitial = middleInitial
    member this.LastName = lastName

    member this.SayFullName() =
        $"{this.FirstName} {this.MiddleInitial} {this.LastName}"

let customer = Customer("Emillia", "C", "Miller")

printfn $"Hello, I'm {customer.SayFullName()}!"

// From https://dotnet.microsoft.com/languages/fsharp
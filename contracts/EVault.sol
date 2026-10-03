// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title EVault - stores SHA-256 hashes of documents so they can be verified later
/// @notice Only the hash is stored on the blockchain, never the document itself.
contract EVault {
    struct Document {
        uint256 id;
        bytes32 hash;
        string fileName;
        address owner;
        uint256 timestamp;
    }

    Document[] private documents;

    // hash => (document index + 1). 0 means "not stored".
    mapping(bytes32 => uint256) private hashToIndex;

    event DocumentStored(
        uint256 indexed id,
        bytes32 indexed hash,
        address indexed owner,
        string fileName,
        uint256 timestamp
    );

    /// @notice Save the hash of a document on the blockchain.
    function storeDocument(bytes32 _hash, string calldata _fileName) external returns (uint256) {
        require(_hash != bytes32(0), "Invalid hash");
        require(hashToIndex[_hash] == 0, "Document already stored");

        uint256 id = documents.length;
        documents.push(Document(id, _hash, _fileName, msg.sender, block.timestamp));
        hashToIndex[_hash] = id + 1;

        emit DocumentStored(id, _hash, msg.sender, _fileName, block.timestamp);
        return id;
    }

    /// @notice Look up a stored document by its ID.
    function getDocument(uint256 _id)
        external
        view
        returns (uint256 id, bytes32 hash, string memory fileName, address owner, uint256 timestamp)
    {
        require(_id < documents.length, "Document does not exist");
        Document storage d = documents[_id];
        return (d.id, d.hash, d.fileName, d.owner, d.timestamp);
    }

    /// @notice Check whether a hash has been stored, and under which ID.
    function findByHash(bytes32 _hash) external view returns (bool found, uint256 id) {
        uint256 index = hashToIndex[_hash];
        if (index == 0) {
            return (false, 0);
        }
        return (true, index - 1);
    }

    /// @notice IDs of all documents stored by a given account.
    function getDocumentsByOwner(address _owner) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < documents.length; i++) {
            if (documents[i].owner == _owner) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < documents.length; i++) {
            if (documents[i].owner == _owner) {
                ids[j] = i;
                j++;
            }
        }
        return ids;
    }

    function getDocumentCount() external view returns (uint256) {
        return documents.length;
    }
}
